# Cell Stock Manager: Synology NAS Docker Install Guide

*[中文版教學請見 SYNOLOGY_DOCKER_INSTALL.zh.md](SYNOLOGY_DOCKER_INSTALL.zh.md)*

This guide is written for life-science researchers with no programming background. The goal is to install Cell Stock Manager on a Synology NAS so that lab members can open one URL in a browser to search, register, take out, and store cell vials.

This guide uses **Container Manager** on Synology DSM 7. If your NAS is still on DSM 6, the package may be called **Docker** instead and the screens will look a bit different — we recommend upgrading DSM first, or asking a colleague who's familiar with the NAS for help.

---

## 0. What you'll get

Once installed, users on the lab's internal network can open the system with a URL like this:

```text
http://your-NAS-IP:8080/cell-stock-manager.html
```

For example:

```text
http://192.168.1.50:8080/cell-stock-manager.html
```

Data is stored in a Docker volume on the NAS — it won't disappear just because you close the browser tab or restart the NAS.

---

## 1. Before you start

Please have ready:

1. A Synology NAS running DSM 7 or later.
2. Access to log in to the DSM admin interface.
3. A DSM account with administrator privileges.
4. The project files from GitHub — on <https://github.com/yuchiao210/cellstock_manager> click **Code → Download ZIP** (then unzip), or `git clone` the repo.
5. The NAS's IP address, e.g. `192.168.1.50`.

If you don't know the NAS's IP address:

1. Log in to DSM in your browser.
2. Open **Control Panel**.
3. Go to **Network** (or **Network Interface**).
4. Check the current LAN IP address.

---

## 2. Install Container Manager

1. Log in to DSM.
2. Open **Package Center**.
3. Search for `Container Manager`.
4. Click **Install**.
5. Once installed, **Container Manager** will appear in the main menu.

If you can't find Container Manager:

- Your NAS model may not support Docker.
- Or your DSM version is too old.
- Or the Package Center sources haven't been updated yet.

---

## 3. Create a project folder

We recommend placing the Docker project inside the NAS's `docker` shared folder.

1. Open **File Station** in DSM.
2. Check the left sidebar for a `docker` shared folder.
3. If it doesn't exist:
   - Open **Control Panel**.
   - Go to **Shared Folder**.
   - Create a new shared folder named `docker`.
4. Inside `docker`, create a folder named:

```text
cellstock
```

The final path should look roughly like:

```text
/volume1/docker/cellstock
```

The actual volume number may be `/volume2` or similar depending on your NAS — just use whatever you see on screen.

---

## 4. Upload the project files

Get the project files from GitHub — either click **Code → Download ZIP** on
<https://github.com/yuchiao210/cellstock_manager> and unzip it, or `git clone` the repo.

Upload everything from the project's top level into the NAS folder you just created:

```text
docker/cellstock
```

After uploading, the folder contents should look like this:

```text
cellstock/
├── .env.example
├── Dockerfile
├── README.md
├── docker-compose.yml
├── app/
└── docker/
```

Important: `docker-compose.yml` must sit directly inside the `cellstock` folder — don't nest it inside an extra folder. A GitHub ZIP usually unzips into a subfolder like `cellstock_manager-main/`; if so, move its contents up so `docker-compose.yml` is directly under `cellstock`.

Wrong:

```text
docker/cellstock/cellstock_manager-main/docker-compose.yml
```

Correct:

```text
docker/cellstock/docker-compose.yml
```

---

## 5. Create the `.env` config file

`.env` is this system's base configuration file — it holds the web port, admin username, admin password, and lab name.

### Method A: Copy the file with File Station

1. In File Station, go into `docker/cellstock`.
2. Find `.env.example`.
3. Make a copy of it.
4. Rename the copy to:

```text
.env
```

If File Station makes it awkward to create a filename starting with `.`, you can create the `.env` file on your own computer first, then upload it to the NAS.

### `.env` contents

Edit `.env` so it looks something like this:

```env
CELLSTOCK_HTTP_PORT=8080
CELLSTOCK_ADMIN_USERNAME=admin
CELLSTOCK_ADMIN_PASSWORD=change-this-to-your-own-strong-password
CELLSTOCK_LAB_NAME=Your Lab Name
CELLSTOCK_DEFAULT_LANG=en
```

Example:

```env
CELLSTOCK_HTTP_PORT=8080
CELLSTOCK_ADMIN_USERNAME=admin
CELLSTOCK_ADMIN_PASSWORD=FCTlab-CellStock-2026
CELLSTOCK_LAB_NAME=FCT Lab
CELLSTOCK_DEFAULT_LANG=en
```

### What each line means

| Setting | Description | Recommendation |
|---|---|---|
| `CELLSTOCK_HTTP_PORT` | Port the web app runs on | Usually `8080` |
| `CELLSTOCK_ADMIN_USERNAME` | Admin username for Maintenance Mode | `admin` is fine to start |
| `CELLSTOCK_ADMIN_PASSWORD` | Admin password for Maintenance Mode | You must change this |
| `CELLSTOCK_LAB_NAME` | Lab name shown at the top of the page | Enter your lab's name |
| `CELLSTOCK_DEFAULT_LANG` | Default interface language on first visit (`en` or `zh`) | Defaults to `en`; can be changed later in Maintenance Mode |

Password recommendations:

- At least 10 characters.
- Include letters and numbers.
- Don't use `admin`, `password`, or `12345678`.
- Don't paste the real password into public documents or group chats.

---

## 6. Create the project in Container Manager

1. Open **Container Manager** in DSM.
2. Click **Project** on the left.
3. Click **Create**.
4. Enter the project name:

```text
cellstock
```

5. For the path, choose the folder you just created:

```text
/volume1/docker/cellstock
```

6. Container Manager should automatically detect:

```text
docker-compose.yml
```

7. If there's a "Source" or "Compose file" option on screen, select the `docker-compose.yml` inside that folder.
8. Click **Next**.
9. If the screen shows `.env`-related settings, confirm it has picked up your `.env` file.
10. Click **Done** or **Create**.

The first time you build this, the NAS will start building the image, which can take a few minutes. That's normal.

---

## 7. Confirm the container is running

1. In Container Manager, click **Container** on the left.
2. Find:

```text
cellstock-manager
```

3. Its status should say "Running".

If you see "Stopped" or it keeps restarting:

1. Click into `cellstock-manager`.
2. Find **Log**.
3. Check for error messages.

The most common cause is a missing password in `.env`:

```text
CELLSTOCK_ADMIN_PASSWORD
```

If the log shows something like:

```text
CELLSTOCK_ADMIN_PASSWORD is required
```

Go back to `.env`, add the password, and restart the project.

---

## 8. Open Cell Stock Manager

From a computer on the same lab network, open a browser and enter:

```text
http://your-NAS-IP:8080/cell-stock-manager.html
```

For example:

```text
http://192.168.1.50:8080/cell-stock-manager.html
```

If you changed `CELLSTOCK_HTTP_PORT` in `.env` to a different number, e.g. `8090`, update the URL accordingly:

```text
http://192.168.1.50:8090/cell-stock-manager.html
```

---

## 9. First use

The first time you open the system, it will ask you to enter the operator's name.

### Chinese-name users

Enter your full Chinese name, e.g.:

```text
王小明
```

Chinese-mode rule: at least 2 Chinese characters.

### English-name users

There's an `EN` button in the top-right corner of the name dialog to switch to English mode first.

English-mode rules:

- At least 2 letters.
- Spaces, `.`, `'`, and `-` are allowed.

Accepted examples:

```text
Yu
Anne-Marie
O'Neil
Y C
```

---

## 10. Entering Maintenance Mode

Maintenance Mode is used to modify inventory records, handle issue reports, and change the admin password.

1. Open Cell Stock Manager.
2. Click **Maintenance Mode** at the top.
3. Enter the username and password set in `.env`:

```text
CELLSTOCK_ADMIN_USERNAME
CELLSTOCK_ADMIN_PASSWORD
```

4. After logging in, we recommend immediately clicking **Change Password** in the top-right corner.

Note: the password in `.env` is mainly used for the first-time initialization. After you change the admin password from within the web app, the system will use the new password stored in the database instead.

---

## 11. Checking installation status

You can open:

```text
http://your-NAS-IP:8080/setup.php
```

This page checks:

- Whether PHP is working correctly.
- Whether the SQLite database is working correctly.
- Whether the database is writable.
- Whether the backup folder is writable.

Once the system is in production use, we recommend not letting non-admins know the URL of `setup.php`.

---

## 12. Where your data is stored

This Docker install method stores data in Docker volumes.

| Data | Location |
|---|---|
| SQLite database | Docker volume: `cellstock-data` |
| Automatic backups | Docker volume: `cellstock-backups` |

You don't need to manage the SQLite file by hand. Regular users only need to back it up periodically.

---

## 13. Backing up the database manually

The simplest way to back up is using Container Manager's terminal.

1. Open Container Manager.
2. Click **Container**.
3. Click `cellstock-manager`.
4. Find **Terminal**.
5. Open a terminal session.
6. Run:

```sh
cp /data/cellstock.sqlite /var/www/html/backups/cellstock-manual-$(date +%Y%m%d-%H%M%S).sqlite
```

The backup file will be placed in the backup volume.

If you're not comfortable with the terminal, ask a colleague familiar with NAS administration to set up scheduled backups for you.

---

## 14. Updating the app

Always back up the database before updating.

Update process:

1. Stop the `cellstock` project in Container Manager.
2. Overwrite the app files in `docker/cellstock` with the new version.
3. Confirm `.env` was not overwritten.
4. Go back to Container Manager.
5. Rebuild or restart the project.

The database lives in a Docker volume, so under normal circumstances it won't disappear when you rebuild the image.

Still, we recommend backing up before every update.

---

## 15. Importing an existing database

This section is for you if you already have a `cellstock.sqlite` file (for example, accumulated production data from a previous manual-install version, or a backup) and want to load it into the Docker version to continue using it, instead of starting from a blank database.

⚠️ Back up this existing `.sqlite` file before you start, so you can restore it if something goes wrong.

1. Confirm the `cellstock` project in Container Manager is **running**.
2. Open **Terminal & SNMP** in DSM and confirm the SSH service is enabled (Control Panel → Terminal & SNMP).
3. Open a terminal on your own computer (on Mac, the "Terminal" app) and SSH into the NAS:

```bash
ssh your-DSM-account@NAS-IP
```

4. Copy the existing database file into the running container:

```bash
docker cp /path-to-your-existing-database/cellstock.sqlite cellstock-manager:/data/cellstock.sqlite
```

For example, if the existing file is at `/volume1/web/cellstock/db/cellstock.sqlite`:

```bash
docker cp /volume1/web/cellstock/db/cellstock.sqlite cellstock-manager:/data/cellstock.sqlite
```

If you renamed `container_name` in `docker-compose.yml` to something else, replace `cellstock-manager` in the command above accordingly.

5. Fix file ownership so the web server user inside the container can read and write it:

```bash
docker exec cellstock-manager chown www-data:www-data /data/cellstock.sqlite
```

6. Restart the container to apply the change:

```bash
docker restart cellstock-manager
```

7. Open `http://NAS-IP:8080/cell-stock-manager.html` and confirm the screen shows the imported data, not a blank database.

Once imported, the database in this volume becomes your "production database" — future app updates (see the previous section) won't touch it again.

---

## 16. Frequently asked questions

### Q1. The URL won't open

Please check:

1. Whether the NAS IP is correct.
2. Whether `CELLSTOCK_HTTP_PORT` in `.env` is `8080`.
3. Whether `cellstock-manager` is running in Container Manager.
4. Whether your computer is on the same network as the NAS.

---

### Q2. The container keeps stopping

Check the log in Container Manager.

Common causes:

- `.env` was never created.
- `.env` doesn't set `CELLSTOCK_ADMIN_PASSWORD`.
- `docker-compose.yml` isn't in the right folder.
- The files ended up nested inside an extra folder.

---

### Q3. Forgot the admin password

If you just forgot the admin password you changed from within the web app, do not delete the database.

Recommended approach:

1. Find whoever maintains the system.
2. Back up the database first.
3. Use a SQLite tool or a maintenance script to reset the admin account.

Do not delete the Docker volume directly, or your inventory data will disappear along with it.

---

### Q4. Will the data disappear if the NAS restarts?

No, not under normal circumstances.

Data lives in a Docker volume, not in the browser.

However, if you manually delete a Docker volume, e.g. `cellstock-data`, the data will be lost. Users unfamiliar with Docker should not delete volumes.

---

### Q5. Can this be exposed to the public internet?

We don't recommend exposing it directly to the internet.

We recommend using it only on the lab's internal network. If you genuinely need external access, ask your IT staff to help set up:

- HTTPS
- VPN
- DSM firewall
- Reverse proxy
- Access restrictions

---

## 17. Ongoing maintenance recommendations

1. Only give the admin password to people who need to maintain the inventory.
2. Back up the database weekly or monthly.
3. Always back up before updating the app.
4. Never delete the Docker volumes.
5. Never share `.env` in a public place.
6. If multiple people share the system, ask everyone to enter their real name, so activity can be traced.

---

## 18. Short SOP for lab admins

Follow this order every time you install or update:

1. Confirm `docker-compose.yml` exists inside `docker/cellstock`.
2. Confirm `.env` exists and the password has been changed.
3. Create or rebuild the `cellstock` project in Container Manager.
4. Confirm `cellstock-manager` is running.
5. Open `http://NAS-IP:8080/cell-stock-manager.html`.
6. Log in to Maintenance Mode with the admin account.
7. Create or confirm the first test record.
8. Back up the database.

---

## 19. The most important safety reminders

Please remember three things:

1. Never use the default password.
2. Never delete the Docker volumes.
3. Always back up the database before updating or making changes.
