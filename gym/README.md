# Fitness Club site

## Two modes

The site starts in **demo mode**: data stays in one browser and the admin password is `admin123`. Good for looking around, not for real use.

**Server mode** keeps everything in MySQL behind a real login. The PHP files are in `/api`.

## Install server mode (shared hosting or a VPS with PHP 8 and MySQL or MariaDB)

1. Create an empty database and a database user in your hosting panel.
2. Import `api/schema.sql` (phpMyAdmin > Import, or `mysql -u USER -p DATABASE < api/schema.sql`).
3. Copy `api/config.sample.php` to `api/config.php` and fill in the database details.
   If your host allows it, keep `config.php` above the public folder and change the path on line 6 of `api/lib.php`.
4. Create your admin login from the command line (SSH or the host's terminal):
   `php api/create_admin.php yourname`
   Choose a password of 12 characters or more. Only a hash is stored.
5. In `fc-config.js` change `window.FC_API = "";` to `window.FC_API = "api/";`
6. Use HTTPS. Without it the login password and session travel in plain text.
7. Open `admin.html`, log in, and check that a test sign-up from the home page appears in Members.

## What the server does

- Login with hashed passwords, a locked-out window after wrong tries, session cookies that JavaScript cannot read, and a security token on every change.
- The admin loads data after login and sends back only the records that changed, so a website sign-up that arrives while you are working is never overwritten.
- One member per phone number (the database enforces it).
- Join form: spam trap field and a limit of 10 per hour per visitor address. It replies "thanks" even if the number is already a member.
- Shop and plan-builder orders are saved as unverified orders.

## Not done yet (read before real use)

- **No payment checking.** Shop and plan-builder orders are recorded from what the browser sends, with no eSewa or Khalti confirmation. Treat them as orders to confirm, not money received.
- One admin role. Front desk and trainer logins with limited access are not built.
- No automatic backups. Set up a daily database backup in your hosting panel.
- Prices are in `fc-data.js` (shown on the pages and used when you mark a member paid).
- The home page schedule is still typed by hand.
- Written without a PHP server to run it on. The browser side was tested against a mock of the API, but the PHP files themselves have not been run. Test on a staging copy first.
