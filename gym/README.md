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

## Logins for members and trainers

Everyone uses the same page, `login.html`. Members type their phone number, trainers and the owner type a username.

- **Member:** open the member's Profile in the admin and press Create login. A 10-character password is made and shown once, with a WhatsApp button to send it. They then see `account.html`: membership, trainer, visits, booking and cancelling sessions up to two weeks ahead, and changing their password.
- **Trainer:** open the Trainers tab and press Create login. They see `trainer.html`: only their own clients (goal, visits, health notes, emergency contact), a notes box per client, and who is booked on their sessions for the next 7 days.
- **Booking rules (checked on the server in server mode):** active membership that covers the session date, the session must run that day, not started yet, a place free, no double booking.
- **Demo mode:** logins are stored as plain text in the browser, for trying things out only. The demo owner login is `admin` / `admin123`.

## Home page schedule

The "This week on the floor" table on the home page now reads the sessions you set up in the admin Schedule tab, with trainer names. If no sessions exist yet it shows the typed-in rows.

## What the server does

- Login with hashed passwords, a locked-out window after wrong tries, session cookies that JavaScript cannot read, and a security token on every change.
- The admin loads data after login and sends back only the records that changed, so a website sign-up that arrives while you are working is never overwritten.
- One member per phone number (the database enforces it).
- Join form: spam trap field and a limit of 10 per hour per visitor address. It replies "thanks" even if the number is already a member.
- Shop and plan-builder orders are saved as unverified orders.

## If you imported an older schema.sql

Run these once: `ALTER TABLE admin_users ADD trainer_id VARCHAR(40) NULL;` and `ALTER TABLE members ADD trainer_id VARCHAR(40) NULL, ADD KEY ix_members_trainer (trainer_id);`
then create the `member_logins` table from the end of `schema.sql`. After that, open each member in the admin and press Save profile once, so their trainer is copied into the new column.

## Not done yet (read before real use)

- **No payment checking.** Shop and plan-builder orders are recorded from what the browser sends, with no eSewa or Khalti confirmation. Treat them as orders to confirm, not money received.
- Roles: owner, trainer and member exist. A front-desk role (members and check-in only, no money) is not built.
- No "forgot password" by email or SMS. The owner resets passwords from the admin.
- Members cannot pay online yet, so renewals are still marked paid by the owner.
- No automatic backups. Set up a daily database backup in your hosting panel.
- Prices are in `fc-data.js` (shown on the pages and used when you mark a member paid).
- Written without a PHP server to run it on. The browser side was tested against a mock of the API, but the PHP files themselves have not been run. Test on a staging copy first.
