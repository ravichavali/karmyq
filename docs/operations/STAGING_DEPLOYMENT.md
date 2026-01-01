# Staging Environment Deployment (Linux Box)

**Server IP**: `192.168.0.148`

## 1. Setup

Follow the same server setup as Production:

```bash
# Windows Users: You can run this in PowerShell
# Or use WinSCP / Putty
scp infrastructure/scripts/setup-server.sh user@192.168.0.148:~/
ssh user@192.168.0.148
chmod +x setup-server.sh
./setup-server.sh
```

## 2. Configuration Differences

1.  **Switch User**: Ensure you switch to the new user: `su - karmyq`
2.  **Repo**: Clone same repo/branch into `/home/karmyq/karmyq`.
3.  **Env File**: You can use `.env.example` as a base.
4.  **Ports**: Staging deployment exposes ports to the local network.

**Accessing Staging**:

You can use a friendly name like `http://karmyq-staging` instead of the IP.

**1. Configure Local DNS (Windows)**:
1.  Open **Notepad** as Administrator.
2.  Open file: `C:\Windows\System32\drivers\etc\hosts`
3.  Add this line at the bottom:
    ```text
    192.168.0.148 karmyq-staging
    ```
4.  Save the file.

**2. Access Links**:
-   **Main Site**: [http://karmyq-staging](http://karmyq-staging)
-   **Direct Port Access** (if needed):
    -   Frontend: http://karmyq-staging:3000
    -   Auth API: http://karmyq-staging:3001
    -   Grafana: http://karmyq-staging:3011

## 3. Deploying

```bash
# As 'karmyq' user
cd ~/karmyq
./infrastructure/scripts/deploy.sh staging
```

This uses `docker-compose.staging.yml` which enables the port mappings.
