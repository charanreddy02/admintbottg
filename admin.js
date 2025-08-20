document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.database();

    const elements = {
        mainLoader: document.getElementById('main-loader'),
        loginContainer: document.getElementById('login-container'),
        adminPanel: document.getElementById('admin-panel'),
        loginBtn: document.getElementById('login-btn'),
        logoutBtn: document.getElementById('logout-btn'),
        tabBtns: document.querySelectorAll('.tab-btn'),
        tabContents: document.querySelectorAll('.tab-content'),
        statTotalUsers: document.getElementById('stat-total-users'),
        statActiveToday: document.getElementById('stat-active-today'),
        withdrawalsContainer: document.getElementById('withdrawals-table-container'),
        usersContainer: document.getElementById('users-table-container'),
        tasksContainer: document.getElementById('tasks-table-container'),
        userSearchInput: document.getElementById('user-search-input'),
        addTaskBtn: document.getElementById('add-task-btn'),
        modalBackdrop: document.getElementById('modal-backdrop'),
        confirmationModal: document.getElementById('confirmation-modal'),
        confirmActionBtn: document.getElementById('confirm-action-btn'),
        toastContainer: document.getElementById('toast-container')
    };

    let confirmCallback = null;

    // --- AUTHENTICATION ---
    auth.onAuthStateChanged(user => {
        elements.mainLoader.classList.add('hidden');
        if (user) {
            db.ref('admins/' + user.uid).once('value', snapshot => {
                if (snapshot.exists()) { showPanel(); } 
                else { alert("Permission denied."); auth.signOut(); }
            });
        } else {
            showLogin();
        }
    });

    elements.loginBtn.addEventListener('click', () => {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        toggleLoader(elements.loginBtn, true);
        auth.signInWithEmailAndPassword(email, password)
            .then(() => showToast("Login Successful!"))
            .catch(error => alert(error.message))
            .finally(() => toggleLoader(elements.loginBtn, false));
    });

    elements.logoutBtn.addEventListener('click', () => auth.signOut());

    function showPanel() {
        elements.loginContainer.classList.add('hidden');
        elements.adminPanel.classList.remove('hidden');
        loadDashboardStats();
    }
    
    function showLogin() {
        elements.loginContainer.classList.remove('hidden');
        elements.adminPanel.classList.add('hidden');
    }

    // --- TAB NAVIGATION & DATA LOADING ---
    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tabId = btn.dataset.tab;
            elements.tabContents.forEach(content => {
                content.id === tabId + '-tab' ? content.classList.add('active') : content.classList.remove('active');
            });
            document.querySelector('header h1').textContent = btn.querySelector('span').textContent;
            
            if (tabId === 'dashboard') loadDashboardStats();
            if (tabId === 'users') loadUsers();
            if (tabId === 'tasks') loadTasks();
            if (tabId === 'withdrawals') loadWithdrawals();
        });
    });

    // --- DASHBOARD ---
    function loadDashboardStats() {
        db.ref('users').on('value', snapshot => {
            const users = snapshot.val();
            const totalUsers = users ? Object.keys(users).length : 0;
            elements.statTotalUsers.textContent = totalUsers;

            let activeToday = 0;
            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            if (users) {
                Object.values(users).forEach(user => {
                    if (user.lastSeen && new Date(user.lastSeen).getTime() >= startOfToday) {
                        activeToday++;
                    }
                });
            }
            elements.statActiveToday.textContent = activeToday;
        });
    }

    // --- USERS ---
    function loadUsers() {
        db.ref('users').on('value', snapshot => {
            let html = `<table><thead><tr><th>User</th><th>Info</th><th>Actions</th></tr></thead><tbody>`;
            if (snapshot.exists()) {
                snapshot.forEach(childSnapshot => {
                    const id = childSnapshot.key;
                    const data = childSnapshot.val();
                    const banBtn = data.isBanned 
                        ? `<button class="action-btn unban-btn" data-id="${id}" data-banned="false">Unban</button>`
                        : `<button class="action-btn ban-btn" data-id="${id}" data-banned="true">Ban</button>`;
                    html += `
                        <tr data-search-term="${(data.name + id + data.mobile).toLowerCase()}">
                            <td><strong>${data.name}</strong><br><small>${id}</small></td>
                            <td>
                                <strong>Balance:</strong> ${data.balance} Rs<br>
                                <strong>Earned:</strong> ${data.totalEarned} Rs<br>
                                <strong>Tasks:</strong> ${data.tasksCompleted}
                            </td>
                            <td>${banBtn}</td>
                        </tr>
                    `;
                });
            }
            html += `</tbody></table>`;
            elements.usersContainer.innerHTML = html;
        });
    }
    
    elements.userSearchInput.addEventListener('input', e => {
        const searchTerm = e.target.value.toLowerCase();
        document.querySelectorAll('#users-table-container tr').forEach(row => {
            if (row.dataset.searchTerm) {
                row.style.display = row.dataset.searchTerm.includes(searchTerm) ? '' : 'none';
            }
        });
    });

    // --- GENERIC ACTION HANDLER ---
    document.addEventListener('click', e => {
        const id = e.target.dataset.id;
        if (!id) return;

        if (e.target.matches('.ban-btn, .unban-btn')) {
            const isBanned = e.target.dataset.banned === 'true';
            const actionText = isBanned ? 'ban' : 'unban';
            showConfirmation(`Are you sure you want to ${actionText} this user?`, () => {
                db.ref('users/' + id).update({ isBanned: isBanned })
                    .then(() => showToast(`User has been ${actionText}ned.`));
            });
        }
        // Add more generic handlers here (delete, approve, reject etc.)
    });

    // --- HELPERS ---
    function toggleLoader(button, show) {
        button.querySelector('.btn-text').classList.toggle('hidden', show);
        button.querySelector('.btn-loader').classList.toggle('hidden', !show);
        button.disabled = show;
    }

    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        elements.toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    function showConfirmation(message, callback) {
        document.getElementById('confirmation-message').textContent = message;
        elements.modalBackdrop.classList.remove('hidden');
        confirmCallback = callback;
    }
    
    elements.confirmActionBtn.addEventListener('click', () => {
        if (confirmCallback) confirmCallback();
        elements.modalBackdrop.classList.add('hidden');
    });

    elements.modalBackdrop.addEventListener('click', e => {
        if (e.target === elements.modalBackdrop || e.target.classList.contains('close-modal-btn')) {
            elements.modalBackdrop.classList.add('hidden');
        }
    });

    // Initial Load
    showLogin();
});
