# ERPNext Custom CRM App (v16)

Custom extensions, layouts, sidebars, and workflows for ERPNext v16 — built to enhance CRM and core operational modules without touching Frappe or ERPNext core source code.

Development happens inside an **isolated Docker Dev Container Sandbox** to guarantee a consistent environment across Windows, Mac, and Linux.

---

## ⚠️ Ground Rules

- **Never modify core files.** Do not touch anything inside the `frappe` or `erpnext` directories.
- All customizations (custom fields, UI layouts, sidebars/workspaces) must be made via the **Desk UI** and exported as **Fixtures** into this app.
- **Never push directly to `main` or `version-16`.** All work goes through feature branches and Pull Requests.

---

## Repository Structure & Branch Policy

| Branch | Purpose |
|---|---|
| `main` | Production — deployed on the Office Server |
| `crm` | CRM pipelines, layouts, logs |
| `inventory` | Stock tracking, items, material requests |
| `hr`, `accounting`, etc. | Additional module branches |

The **Office Server** runs `main` in production. Developers work on module branches, open PRs into `version-16`, and merging into `main` triggers an automated deployment.

---

## Environment Setup

### Prerequisites

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and ensure it's running.
   - **Windows:** WSL2 must be enabled (Docker will prompt you).
   - **Memory:** Open Docker Desktop → Settings → Resources and allocate **at least 6–8 GB RAM**.
2. Install [Visual Studio Code](https://code.visualstudio.com/).
3. Install the **Dev Containers** extension in VS Code (published by Microsoft).

### Step 1 — Initialize the Frappe Docker Environment

```bash
cd ~
git clone https://github.com/frappe/frappe_docker.git
cd frappe_docker

cp -R devcontainer-example .devcontainer
cp -R development/vscode-example development/.vscode

code .
```

### Step 2 — Open the Dev Container

When VS Code opens, click **"Reopen in Container"** on the popup that appears.

If the popup doesn't appear: `Ctrl+Shift+P` → **Dev Containers: Reopen in Container**.

Wait for Docker to build. When done, your terminal prompt will show:

```
frappe@<container_id>:/workspace/development$
```

### Step 3 — Set Up the Local Site

Run all commands below from your **VS Code container terminal**.

**3a. Initialize the bench:**
```bash
bench init --skip-redis-config-generation --frappe-branch version-16 frappe-bench
cd frappe-bench
```

> All subsequent commands must run from inside `frappe-bench`.

**3b. Configure Docker networking:**
```bash
bench set-config -g db_host mariadb
bench set-config -g redis_cache redis://redis-cache:6379
bench set-config -g redis_queue redis://redis-queue:6379
bench set-config -g redis_socketio redis://redis-queue:6379
```

**3c. Download ERPNext v16:**
```bash
bench get-app --branch version-16 erpnext
```

**3d. Download this custom app:**
```bash
bench get-app https://github.com/ASteamcode/ERP-NEXT---1.git erp_next_custom
```

**3e. Create the local site:**
```bash
# These credentials are for local development only — never use in staging or production
bench new-site dev.localhost --db-root-password 123 --admin-password admin --mariadb-user-host-login-scope=%
```

**3f. Enable Developer Mode:**
```bash
bench --site dev.localhost set-config developer_mode 1
```

**3g. Install apps:**
```bash
bench --site dev.localhost install-app erpnext
bench --site dev.localhost install-app erp_next_custom
```

**3h. Set default site and start:**
```bash
bench use dev.localhost
bench start
```

### Step 4 — Access the System

Open your browser at **http://localhost:8000**

| Field | Value |
|---|---|
| Username | `Administrator` |
| Password | `admin` (or whatever you set in Step 3e) |

---

## Git Workflow

All work starts from your custom app directory inside the container terminal:

```bash
cd /workspace/development/frappe-bench/apps/erp_next_custom
```

### Option 1: Terminal (CLI)

```bash
# 1. Pull the latest integration branch
git checkout version-16
git pull origin version-16

# 2. Switch to (or create) your module branch
git checkout -b crm        # first time
git checkout crm           # returning

# 3. Stage and commit your changes
git status
git add .
git commit -m "feat: added customized overview sidebar links to crm workspace"

# 4. Push and open a Pull Request into version-16
git push origin crm
```

### Option 2: VS Code GUI

- **Switch branches:** Click the branch name in the bottom-left status bar.
- **Stage changes:** Open the Source Control panel (branch icon in Activity Bar), click **+** next to changed files.
- **Commit:** Type a message in the Message box and click the **✓ Commit** button.
- **Push:** Click **Sync Changes** or use the `...` menu → Push.

---

## Troubleshooting

**"Not Found" on localhost:8000**

The server doesn't know which site to route to. In a new terminal tab (inside the container), run:

```bash
cd /workspace/development/frappe-bench
bench use dev.localhost
```

Then refresh your browser.