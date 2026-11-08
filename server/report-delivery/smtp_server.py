"""Private SMTP report receiver; deploy separately from the static site."""
import hashlib
import json
import os
import re
import smtplib
import sqlite3
import ssl
import threading
import time
from collections import deque
from contextlib import contextmanager
from email.message import EmailMessage
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

DATA = Path(os.environ.get('DATA_DIR', '/data'))
ORIGIN = os.environ.get('SITE_ORIGIN', 'https://enemetria.com.br')
MAX_BODY = 1500000


@contextmanager
def database():
    con = sqlite3.connect(DATA / 'reports.sqlite3', timeout=15)
    con.row_factory = sqlite3.Row
    try:
        with con:
            yield con
    finally:
        con.close()


def initialize():
    DATA.mkdir(parents=True, exist_ok=True)
    with database() as con:
        con.execute('''CREATE TABLE IF NOT EXISTS reports (
          session TEXT PRIMARY KEY, digest TEXT NOT NULL, email TEXT NOT NULL,
          report TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending',
          attempts INTEGER NOT NULL DEFAULT 0, next_try REAL NOT NULL DEFAULT 0,
          created REAL NOT NULL, last_error TEXT)''')
        # A crash after SMTP acceptance has an uncertain delivery outcome.
        # Never automatically resend these ambiguous messages.
        con.execute("UPDATE reports SET state='uncertain' WHERE state='sending'")


def smtp_connect():
    server = smtplib.SMTP('smtp.gmail.com', 587, timeout=20)
    try:
        server.ehlo()
        server.starttls(context=ssl.create_default_context())
        server.ehlo()
        server.login(os.environ['SMTP_USER'], os.environ['SMTP_PASSWORD'])
        return server
    except Exception:
        server.close()
        raise


def validate(data):
    if not isinstance(data, dict) or data.get('consent') is not True:
        raise ValueError('consent')
    email = data.get('email', '')
    session = data.get('sessionId', '')
    report = data.get('report', '')
    if not isinstance(email, str) or len(email) > 254 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
        raise ValueError('email')
    if not isinstance(session, str) or not re.fullmatch(r'[a-zA-Z0-9:_-]{1,160}', session):
        raise ValueError('session')
    if data.get('examId') != 'pcpe-agente-2024-02-25' or not isinstance(report, str) or session not in report or 'SESSAO_ESTRUTURADA_JSON_INICIO' not in report:
        raise ValueError('report')
    return email, session, report


def enqueue(data):
    email, session, report = validate(data)
    digest = hashlib.sha256((email + '\n' + report).encode()).hexdigest()
    with database() as con:
        con.execute('INSERT OR IGNORE INTO reports(session,digest,email,report,created) VALUES(?,?,?,?,?)',
                    (session, digest, email, report, time.time()))
        row = con.execute('SELECT digest FROM reports WHERE session=?', (session,)).fetchone()
        if row['digest'] != digest:
            raise FileExistsError('session already has a different payload')
    return session


def deliver(row):
    message = EmailMessage()
    message['From'] = os.environ['SMTP_USER']
    message['To'] = os.environ['REPORT_TO']
    message['Reply-To'] = row['email']
    message['Subject'] = 'Enemetria - PC PE - ' + row['session']
    message['Message-ID'] = '<' + hashlib.sha256(row['session'].encode()).hexdigest() + '@enemetria.com.br>'
    message.set_content('Novo relatorio para analise.\nContato para devolutiva: ' + row['email'] + '\nConsentimento: concedido.\nO relatorio completo esta anexado.')
    message.add_attachment(row['report'].encode('utf-8'), maintype='text', subtype='plain', filename='pcpe-' + re.sub(r'[^a-zA-Z0-9_-]', '-', row['session']) + '.txt')
    with smtp_connect() as server:
        server.send_message(message)


def process_one():
    with database() as con:
        row = con.execute("SELECT * FROM reports WHERE state='pending' AND next_try<=? ORDER BY created LIMIT 1", (time.time(),)).fetchone()
        if row is None:
            return
        con.execute("UPDATE reports SET state='sending', attempts=attempts+1 WHERE session=?", (row['session'],))
    try:
        deliver(row)
    except Exception as error:
        attempts = row['attempts'] + 1
        # Socket errors after DATA can mean acceptance without acknowledgement.
        safe_retry = isinstance(error, (smtplib.SMTPAuthenticationError, smtplib.SMTPRecipientsRefused, smtplib.SMTPDataError, smtplib.SMTPConnectError))
        state = ('pending' if attempts < 5 else 'failed') if safe_retry else 'uncertain'
        with database() as con:
            con.execute('UPDATE reports SET state=?, next_try=?, last_error=? WHERE session=?',
                        (state, time.time() + min(3600, 60 * 2 ** attempts), type(error).__name__, row['session']))
        print('SMTP result: ' + state + ' (' + type(error).__name__ + ')', flush=True)
    else:
        with database() as con:
            con.execute("UPDATE reports SET state='sent', last_error=NULL WHERE session=?", (row['session'],))
        print('SMTP accepted one report', flush=True)


def worker():
    while True:
        try:
            process_one()
        except Exception as error:
            print('Queue error: ' + type(error).__name__, flush=True)
        time.sleep(5)


class Handler(BaseHTTPRequestHandler):
    requests = deque()

    def setup(self):
        super().setup()
        self.connection.settimeout(15)

    def log_message(self, *_args):
        pass  # No student data in request logs.

    def reply(self, code, value):
        body = json.dumps(value).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Access-Control-Allow-Origin', ORIGIN)
        self.send_header('Vary', 'Origin')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        self.reply(200 if self.path == '/health' else 404, {'ok': self.path == '/health'})

    def do_OPTIONS(self):
        self.reply(200 if self.headers.get('Origin') == ORIGIN else 403, {})

    def do_POST(self):
        if self.path != '/reports':
            return self.reply(404, {'accepted': False})
        if self.headers.get('Origin') != ORIGIN:
            return self.reply(403, {'accepted': False})
        now = time.time()
        while self.requests and now - self.requests[0] > 60:
            self.requests.popleft()
        if len(self.requests) >= 10:
            return self.reply(429, {'accepted': False})
        self.requests.append(now)
        try:
            size = int(self.headers.get('Content-Length', 0))
            if size <= 0 or size > MAX_BODY:
                return self.reply(413, {'accepted': False})
            raw = self.rfile.read(size)
            if len(raw) != size:
                raise ValueError('incomplete')
            session = enqueue(json.loads(raw))
        except FileExistsError:
            return self.reply(409, {'accepted': False})
        except (ValueError, UnicodeError):
            return self.reply(400, {'accepted': False})
        except Exception:
            return self.reply(503, {'accepted': False})
        # Acknowledges durable receipt for review, not guaranteed mailbox delivery.
        self.reply(200, {'accepted': True, 'sessionId': session})


if __name__ == '__main__':
    if not all(os.environ.get(key) for key in ('SMTP_USER', 'SMTP_PASSWORD', 'REPORT_TO')):
        raise SystemExit('Missing SMTP configuration')
    if os.environ.get('CHECK_SMTP') == '1':
        with smtp_connect():
            print('SMTP autenticado com sucesso.')
    else:
        initialize()
        threading.Thread(target=worker, daemon=True).start()
        HTTPServer(('0.0.0.0', 8080), Handler).serve_forever()
