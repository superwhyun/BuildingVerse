export class AdminManager {
    constructor(uiManager) {
        this.uiManager = uiManager;
        this.isAdmin = false;

        // Check session (simple local check for now, non-secure)
        if (localStorage.getItem('adminToken')) {
            this.isAdmin = true;
        }

        this.setupUI();
    }

    setupUI() {
        // Create Admin Login Button if not exists
        if (!document.getElementById('btn-admin-login')) {
            const btn = document.createElement('button');
            btn.id = 'btn-admin-login';
            btn.textContent = this.isAdmin ? 'Admin Logout' : 'Admin Login';
            btn.style.position = 'absolute';
            btn.style.top = '10px';
            btn.style.right = '10px';
            btn.style.zIndex = '1000';
            btn.onclick = () => this.handleLoginClick();
            document.body.appendChild(btn);
        }

        this.updateUIState();
    }

    updateUIState() {
        const btn = document.getElementById('btn-admin-login');
        if (btn) btn.textContent = this.isAdmin ? 'Admin Logout' : 'Admin Login';
        if (this.uiManager) this.uiManager.setAdmin(this.isAdmin);
    }

    async handleLoginClick() {
        if (this.isAdmin) {
            // Logout
            this.isAdmin = false;
            localStorage.removeItem('adminToken');
            this.updateUIState();
            alert("Logged out");
            location.reload(); // Reload to refresh view/permissions
        } else {
            // Login
            const pwd = prompt("Enter Admin Password:");
            if (!pwd) return;

            try {
                const res = await fetch('/api/admin/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password: pwd })
                });
                const data = await res.json();
                if (data.success) {
                    this.isAdmin = true;
                    localStorage.setItem('adminToken', data.token);
                    this.updateUIState();
                    alert("Logged in as Admin");
                    location.reload();
                } else {
                    alert("Login Failed");
                }
            } catch (e) {
                console.error(e);
                alert("Error logging in");
            }
        }
    }
}
