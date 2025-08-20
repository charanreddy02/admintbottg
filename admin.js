document.addEventListener('DOMContentLoaded', () => {
    // --- Firebase & Auth Setup ---
    const auth = firebase.auth();
    const db = firebase.database();

    // --- DOM Elements ---
    const loginContainer = document.getElementById('login-container');
    const adminPanel = document.getElementById('admin-panel');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const adminEmailSpan = document.getElementById('admin-email');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Global state
    let currentAdminRole = null;
    let withdrawalToReject = null;
    let userToEdit = null;
    
    // --- AUTHENTICATION ---
    auth.onAuthStateChanged(user => {
        if (user) {
            db.ref('admins/' + user.uid).once('value', snapshot => {
                if (snapshot.exists()) {
                    currentAdminRole = snapshot.val().role;
                    showPanel(user.email);
                } else {
                    alert("You do not have permission to access this panel.");
                    auth.signOut();
                }
            });
        } else {
            showLogin();
        }
    });

    loginBtn.addEventListener('click', () => {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        auth.signInWithEmailAndPassword(email, password).catch(error => alert(error.message));
    });

    logoutBtn.addEventListener('click', () => auth.signOut());

    function showPanel(email) {
        loginContainer.classList.add('hidden');
        adminPanel.classList.remove('hidden');
        adminEmailSpan.textContent = email;
        loadWithdrawals();
        
        // Role-based access
        if (currentAdminRole !== 'superadmin') {
            document.getElementById('manage-admins-tab').classList.add('hidden');
        } else {
            document.getElementById('manage-admins-tab').classList.remove('hidden');
        }
    }
    
    function showLogin() {
        loginContainer.classList.remove('hidden');
        adminPanel.classList.add('hidden');
    }

    // --- TAB NAVIGATION ---
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tabId = btn.dataset.tab;
            tabContents.forEach(content => {
                content.id === tabId + '-tab' ? content.classList.add('active') : content.classList.remove('active');
            });
            // Load data for the activated tab
            if (tabId === 'users') loadUsers();
            if (tabId === 'tasks') loadTasks();
            if (tabId === 'withdrawals') loadWithdrawals();
        });
    });

    // --- WITHDRAWALS LOGIC ---
    function loadWithdrawals() {
        const tableBody = document.getElementById('withdrawals-table').querySelector('tbody');
        db.ref('withdrawals').orderByChild('status').equalTo('pending').on('value', snapshot => {
            tableBody.innerHTML = '';
            snapshot.forEach(childSnapshot => {
                const id = childSnapshot.key;
                const data = childSnapshot.val();
                const row = `
                    <tr>
                        <td>${data.userName} (${data.userId})</td>
                        <td>${data.amount} Rs</td>
                        <td>${data.address}</td>
                        <td>${new Date(data.timestamp).toLocaleString()}</td>
                        <td>
                            <button class="action-btn approve-btn" data-id="${id}">Approve</button>
                            <button class="action-btn reject-btn" data-id="${id}">Reject</button>
                        </td>
                    </tr>
                `;
                tableBody.innerHTML += row;
            });
        });
    }

    document.getElementById('withdrawals-table').addEventListener('click', e => {
        const id = e.target.dataset.id;
        if (e.target.classList.contains('approve-btn')) {
            db.ref('withdrawals/' + id).update({ status: 'success' });
        }
        if (e.target.classList.contains('reject-btn')) {
            withdrawalToReject = id;
            openModal('reject-modal');
        }
    });

    document.getElementById('confirm-reject-btn').addEventListener('click', () => {
        const remarks = document.getElementById('reject-remarks').value;
        db.ref('withdrawals/' + withdrawalToReject).update({ status: 'rejected', remarks: remarks || 'N/A' });
        closeModals();
    });

    // --- USERS LOGIC ---
    function loadUsers() {
        const tableBody = document.getElementById('users-table').querySelector('tbody');
        db.ref('users').on('value', snapshot => {
            tableBody.innerHTML = '';
            snapshot.forEach(childSnapshot => {
                const id = childSnapshot.key;
                const data = childSnapshot.val();
                const banBtn = data.isBanned 
                    ? `<button class="action-btn unban-btn" data-id="${id}" data-banned="false">Unban</button>`
                    : `<button class="action-btn ban-btn" data-id="${id}" data-banned="true">Ban</button>`;
                const row = `
                    <tr>
                        <td>${data.name}</td>
                        <td>${data.mobile}</td>
                        <td>${data.balance} Rs</td>
                        <td>${data.isBanned ? 'Yes' : 'No'}</td>
                        <td>
                            <button class="action-btn edit-btn" data-id="${id}">Edit</button>
                            ${banBtn}
                        </td>
                    </tr>
                `;
                tableBody.innerHTML += row;
            });
        });
    }

    document.getElementById('users-table').addEventListener('click', e => {
        const id = e.target.dataset.id;
        if (e.target.classList.contains('ban-btn') || e.target.classList.contains('unban-btn')) {
            const isBanned = e.target.dataset.banned === 'true';
            db.ref('users/' + id).update({ isBanned: isBanned });
        }
        if (e.target.classList.contains('edit-btn')) {
            userToEdit = id;
            db.ref('users/' + id).once('value', snapshot => {
                const data = snapshot.val();
                document.getElementById('edit-user-name').textContent = data.name;
                document.getElementById('edit-user-balance').value = data.balance;
                openModal('edit-user-modal');
            });
        }
    });
    
    document.getElementById('confirm-edit-user-btn').addEventListener('click', () => {
        const newBalance = document.getElementById('edit-user-balance').value;
        db.ref('users/' + userToEdit).update({ balance: parseInt(newBalance, 10) });
        closeModals();
    });
    
    // --- TASKS LOGIC ---
    function loadTasks() {
        const tableBody = document.getElementById('tasks-table').querySelector('tbody');
        db.ref('dailyTasks').on('value', snapshot => {
            tableBody.innerHTML = '';
            snapshot.forEach(childSnapshot => {
                const id = childSnapshot.key;
                const data = childSnapshot.val();
                const row = `
                    <tr>
                        <td>${data.title}</td>
                        <td>${data.description}</td>
                        <td>${data.reward} Rs</td>
                        <td><button class="action-btn delete-btn" data-id="${id}">Delete</button></td>
                    </tr>
                `;
                tableBody.innerHTML += row;
            });
        });
    }

    document.getElementById('add-task-btn').addEventListener('click', () => {
        const title = document.getElementById('task-title').value;
        const description = document.getElementById('task-desc').value;
        const reward = parseInt(document.getElementById('task-reward').value, 10);
        if (title && description && reward) {
            db.ref('dailyTasks').push({ title, description, reward, active: true });
            document.getElementById('task-title').value = '';
            document.getElementById('task-desc').value = '';
            document.getElementById('task-reward').value = '';
        } else {
            alert('Please fill all task fields.');
        }
    });

    document.getElementById('tasks-table').addEventListener('click', e => {
        if (e.target.classList.contains('delete-btn')) {
            if (confirm('Are you sure you want to delete this task?')) {
                db.ref('dailyTasks/' + e.target.dataset.id).remove();
            }
        }
    });
    
     // --- ADMIN MANAGEMENT (Superadmin only) ---
    document.getElementById('add-admin-btn').addEventListener('click', () => {
        const email = document.getElementById('new-admin-email').value;
        const password = document.getElementById('new-admin-password').value;
        const role = document.getElementById('new-admin-role').value;

        // This is a simplified creation process. A secondary Firebase instance is needed to do this without logging out.
        // For now, we will alert the user about the process.
        alert("Admin creation requires a more complex setup (secondary Firebase app). For now, please add new admins manually via the Firebase Authentication console and add their role in the Realtime Database, just like you did for your own account.");
    });


    // --- MODAL HELPERS ---
    const modalBackdrop = document.getElementById('modal-backdrop');
    function openModal(modalId) {
        modalBackdrop.classList.remove('hidden');
        document.getElementById(modalId).classList.remove('hidden');
    }
    function closeModals() {
        modalBackdrop.classList.add('hidden');
        modalBackdrop.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    }
    modalBackdrop.addEventListener('click', e => {
        if (e.target === modalBackdrop || e.target.classList.contains('close-modal-btn')) {
            closeModals();
        }
    });
});
