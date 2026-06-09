# ERPNext Custom CRM App (v16)

Welcome to the team! This repository contains our custom extensions, layouts, sidebars, and workflows for ERPNext v16—built specifically to enhance the CRM and core operational modules without altering Frappe or ERPNext core source code.

To protect project stability and make onboarding seamless, we develop inside an isolated **Docker Dev Container Sandbox**. This guarantees that your local environment matches the team standard identically, regardless of whether you are running Windows, Mac, or Linux.

---

## Repository Architecture & Git Workflow

### Crucial Rule: Do NOT Modify Core Code

Never touch or modify files inside the standard `frappe` or `erpnext` directories. All customizations (custom fields, UI layouts, sidebar/workspaces) must be made via the Desk UI and exported into this app as **Fixtures**.

### Branching Policy

We enforce a strict code review policy. No developer is permitted to push code directly to the `main` branch.

- **`main`**: The stable, production-ready baseline.
- **`version-16`**: Our active development/staging branch.

---

## 5-Minute Environment Setup Guide

Follow these steps exactly to get a fully working ERPNext v16 environment running locally on your computer.

### Prerequisites (On Your Host Machine)

1. Install **Docker Desktop** from https://www.docker.com/products/docker-desktop/ and make sure it is running.
   - **Windows users:** WSL2 must be enabled. Docker Desktop will prompt you to install it if it isn't.
   - **Important:** ERPNext requires significant memory. Before proceeding, open Docker Desktop → Settings → Resources and allocate at least **6–8 GB of RAM**.
2. Install **Visual Studio Code (VS Code)**.
3. Install the **Dev Containers** extension inside VS Code (published by Microsoft).

---

### Step 1: Initialize the Frappe Docker Environment

Open your local terminal and run:

```bash
# Move to your projects directory
cd ~

# Clone the official Frappe Docker development container tools
git clone https://github.com/frappe/frappe_docker.git
cd frappe_docker

# Copy the development container environment configurations
cp -R devcontainer-example .devcontainer
cp -R development/vscode-example development/.vscode

# Open this workspace in VS Code
code .
```

---

### Step 2: Open the Dev Container Sandbox

1. When VS Code opens, a popup will appear: **"Folder contains a Dev Container configuration file. Reopen in Container?"** — click **Reopen in Container**.
2. If the popup doesn't appear, press `Ctrl + Shift + P` (or `Cmd + Shift + P` on Mac), type `Dev Containers: Reopen in Container`, and hit Enter.
3. **Wait.** Docker will download and build the exact Python, Node, MariaDB, and Redis environments required. When it finishes, your terminal prompt will change to:
   ```
   frappe@<container_id>:/workspace/development$
   ```

---

### Step 3: Fetch the Codebase & Create the Local Site

Run these commands inside your active **VS Code container terminal**:

**3a. Initialize the local Frappe bench (version 16):**
```bash
bench init --skip-redis-config-generation --frappe-branch version-16 frappe-bench
cd frappe-bench
```

> All subsequent commands must be run from inside the `frappe-bench` directory.

**3b. Configure network routing for Docker containers:**
```bash
bench set-config -g db_host mariadb
bench set-config -g redis_cache redis://redis-cache:6379
bench set-config -g redis_queue redis://redis-queue:6379
bench set-config -g redis_socketio redis://redis-queue:6379
```

**3c. Download the core ERPNext v16 framework:**
```bash
bench get-app --branch version-16 erpnext
```

**3d. Download this custom app into the bench:**
```bash
# The second argument 'erp_next_custom' is the local alias for this app
bench get-app https://github.com/ASteamcode/ERP-NEXT---1.git erp_next_custom
```

**3e. Build the local database site:**
```bash
# Note: these credentials are for local development only — never use in staging or production
bench new-site dev.localhost --db-root-password 123 --admin-password admin --mariadb-user-host-login-scope=%
```

**3f. Enable Developer Mode so UI configurations track correctly:**
```bash
bench --site dev.localhost set-config developer_mode 1
```

**3g. Install ERPNext and our custom app onto the site:**
```bash
bench --site dev.localhost install-app erpnext
bench --site dev.localhost install-app erp_next_custom
```

**3h. Define the default site:**
```bash
bench use dev.localhost
```

**3i. Boot the development server:**
```bash
bench start
```

---

### Step 4: Access the System

Once your terminal shows that `bench start` is running smoothly, open your browser and navigate to:

**`http://localhost:8000`**

#### Default Login Credentials

| Field    | Value                                                              |
|----------|--------------------------------------------------------------------|
| Username | `Administrator`                                                    |
| Password | `admin` *(or the custom admin password you set in Step 3e above)* |

---

## Troubleshooting

**"Not Found" error on `localhost:8000`**

The server is running but doesn't know which database site to route to. Open a new terminal tab in VS Code, make sure you are in `/workspace/development/frappe-bench`, and run:

```bash
bench use dev.localhost
```

Then refresh your browser and the ERPNext login page will load.
