document.addEventListener('DOMContentLoaded', function() {
    const tg = window.Telegram.WebApp;
    if (!tg || !tg.initDataUnsafe?.user) {
        document.body.innerHTML = "<h1>Error: Please open this app inside Telegram.</h1>"; return;
    }
    tg.ready(); tg.expand();

    const loginScreen = document.getElementById('login-screen');
    const appScreen = document.getElementById('app');
    const userDetailsForm = document.getElementById('user-details-form');
    const telegramUser = tg.initDataUnsafe.user;
    const userId = telegramUser.id.toString();

    function init() {
        const userRef = database.ref('users/' + userId);
        userRef.once('value', (snapshot) => {
            if (snapshot.exists() && snapshot.val().mobile) {
                initializeAppView(snapshot.val());
            } else {
                showLoginScreen();
            }
        }).catch(handleFirebaseError);
    }

    function handleFirebaseError(error) { console.error("Firebase error:", error); document.body.innerHTML = "<h1>Error connecting to the database. Please try again.</h1>"; }
    function showLoginScreen() { loginScreen.style.display = 'flex'; appScreen.classList.add('hidden'); }

    function initializeAppView(userData) {
        loginScreen.style.display = 'none';
        appScreen.classList.remove('hidden');
        const userDisplayName = userData.name || `${telegramUser.first_name} ${telegramUser.last_name || ''}`.trim();
        document.querySelectorAll('.username').forEach(el => { el.innerHTML = `${userDisplayName} <i class="fas fa-gem diamond"></i>`; });
        const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(userDisplayName)}&background=random&color=fff&size=128`;
        document.querySelectorAll('.profile-pic').forEach(img => img.src = avatarUrl);
        document.querySelector('.join-date').textContent = `Joined: ${new Date(userData.joinedDate).toLocaleDateString()}`;
        initializeCoreAppLogic(userData);
    }

    userDetailsForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const mobileNumber = document.getElementById('mobile-number').value;
        if (!mobileNumber.trim()) { alert('Please enter your mobile number.'); return; }
        const newUserData = {
            name: `${telegramUser.first_name} ${telegramUser.last_name || ''}`.trim(),
            mobile: mobileNumber, telegramUsername: telegramUser.username || 'N/A', telegramId: userId,
            balance: 0, totalEarned: 0, tasksCompleted: 0,
            joinedDate: new Date().toISOString(),
            lastClaimTimestamp: 0,
            completedTasks: {}
        };
        database.ref('users/' + userId).set(newUserData).then(() => initializeAppView(newUserData)).catch(handleFirebaseError);
    });
    
    document.getElementById('logout-btn').addEventListener('click', () => {
        if (confirm("Are you sure you want to log out?")) {
            database.ref('users/' + userId + '/mobile').remove().then(() => {
                alert("You have been logged out.");
                location.reload();
            });
        }
    });

    init();
});

function initializeCoreAppLogic(userData) {
    const userId = userData.telegramId;
    let currentUserData = { ...userData };

    const elements = {
        balance: document.querySelectorAll('.balance, .balance-badge'),
        statsLifetimeTasks: document.getElementById('stats-lifetime-tasks'),
        statsTotalEarnings: document.getElementById('stats-total-earnings'),
        profileTotalEarned: document.getElementById('profile-total-earned'),
        profileTasksDone: document.getElementById('profile-tasks-done'),
        navItems: document.querySelectorAll('.nav-item'),
        pages: document.querySelectorAll('.page'),
        startTaskButtons: document.querySelectorAll('.start-task-btn'),
        requestWithdrawalBtn: document.querySelector('.request-withdrawal-btn'),
        successPopup: document.getElementById('success-popup'),
        rewardMessage: document.getElementById('reward-message'),
        popupCloseBtn: document.querySelector('.popup-close'),
        claimBonusBtn: document.getElementById('claim-bonus-btn'),
        withdrawalHistoryList: document.getElementById('withdrawal-history-list'),
        dynamicTasksList: document.getElementById('dynamic-tasks-list')
    };

    function updateAllStatsUI() {
        elements.balance.forEach(el => el.textContent = `${currentUserData.balance} Rs`);
        elements.statsLifetimeTasks.textContent = currentUserData.tasksCompleted;
        elements.statsTotalEarnings.textContent = currentUserData.totalEarned;
        elements.profileTasksDone.textContent = currentUserData.tasksCompleted;
        elements.profileTotalEarned.textContent = `${currentUserData.totalEarned} Rs`;
    }

    function showSuccessPopup(message) { elements.rewardMessage.textContent = message; elements.successPopup.classList.remove('hidden'); }
    function hideSuccessPopup() { elements.successPopup.classList.add('hidden'); }

    function handleDailyCheckin() {
        const lastClaim = currentUserData.lastClaimTimestamp || 0;
        const now = new Date();
        const lastClaimDate = new Date(lastClaim);
        const isSameDay = now.getFullYear() === lastClaimDate.getFullYear() && now.getMonth() === lastClaimDate.getMonth() && now.getDate() === lastClaimDate.getDate();

        if (!isSameDay) {
            elements.claimBonusBtn.disabled = false;
            elements.claimBonusBtn.querySelector('span').textContent = "Claim Reward";
        } else {
            elements.claimBonusBtn.disabled = true;
            elements.claimBonusBtn.querySelector('span').textContent = "Claimed Today";
        }
    }

    function renderWithdrawalHistory() {
        const query = database.ref('withdrawals').orderByChild('userId').equalTo(userId);
        query.on('value', snapshot => {
            elements.withdrawalHistoryList.innerHTML = '';
            if (!snapshot.exists()) {
                elements.withdrawalHistoryList.innerHTML = '<p class="no-referrals">No withdrawal history found.</p>';
                return;
            }
            snapshot.forEach(childSnapshot => {
                const data = childSnapshot.val();
                const item = document.createElement('div');
                item.className = 'withdrawal-history-item';
                let remarksHTML = data.status === 'rejected' && data.remarks ? `<p class="withdrawal-remarks">Reason: ${data.remarks}</p>` : '';
                item.innerHTML = `
                    <span class="withdrawal-status status-${data.status}">${data.status}</span>
                    <p><strong>Amount:</strong> ${data.amount} Rs</p>
                    <p><strong>UPI:</strong> ${data.address}</p>
                    <p><small>${new Date(data.timestamp).toLocaleString()}</small></p>
                    ${remarksHTML}
                `;
                elements.withdrawalHistoryList.prepend(item);
            });
        });
    }
    
    function renderDynamicTasks() {
        const tasksRef = database.ref('dailyTasks');
        tasksRef.on('value', snapshot => {
            elements.dynamicTasksList.innerHTML = '';
            if (!snapshot.exists()) {
                elements.dynamicTasksList.innerHTML = '<p class="no-referrals">No new tasks available today.</p>';
                return;
            }
            const completed = currentUserData.completedTasks || {};
            snapshot.forEach(childSnapshot => {
                const taskId = childSnapshot.key;
                const task = childSnapshot.val();
                const isCompleted = completed[taskId];
                
                const taskItem = document.createElement('div');
                taskItem.className = 'dynamic-task-item';
                taskItem.innerHTML = `
                    <div>
                        <h3>${task.title}</h3>
                        <p>${task.description}</p>
                    </div>
                    <button class="complete-task-btn" data-task-id="${taskId}" data-reward="${task.reward}" ${isCompleted ? 'disabled' : ''}>
                        ${isCompleted ? 'Completed' : `+${task.reward} Rs`}
                    </button>
                `;
                elements.dynamicTasksList.appendChild(taskItem);
            });
        });
    }

    // --- Event Listeners ---
    elements.navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            elements.navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
            const pageId = this.getAttribute('href').substring(1);
            elements.pages.forEach(page => page.classList.remove('active'));
            document.getElementById(pageId).classList.add('active');
        });
    });

    elements.claimBonusBtn.addEventListener('click', () => {
        const reward = Math.floor(Math.random() * (10 - 5 + 1)) + 5;
        currentUserData.balance += reward;
        currentUserData.totalEarned += reward;
        currentUserData.lastClaimTimestamp = Date.now();
        database.ref('users/' + userId).update({
            balance: currentUserData.balance,
            totalEarned: currentUserData.totalEarned,
            lastClaimTimestamp: currentUserData.lastClaimTimestamp
        });
        updateAllStatsUI();
        handleDailyCheckin();
        showSuccessPopup(`You claimed a daily bonus of ${reward} Rs!`);
    });
    
    elements.startTaskButtons.forEach(button => {
        button.addEventListener('click', function() {
            if (typeof show_9724340 === 'function') {
                show_9724340().then(() => {
                    const reward = Math.floor(Math.random() * 5) + 1; // 1-5 Rs
                    currentUserData.balance += reward;
                    currentUserData.totalEarned += reward;
                    currentUserData.tasksCompleted++;
                    database.ref('users/' + userId).update({
                        balance: currentUserData.balance,
                        totalEarned: currentUserData.totalEarned,
                        tasksCompleted: currentUserData.tasksCompleted
                    });
                    updateAllStatsUI();
                    showSuccessPopup(`You earned ${reward} Rs for watching an ad!`);
                }).catch(error => console.error("Ad error:", error));
            } else { alert('Ad service is not available.'); }
        });
    });

    elements.dynamicTasksList.addEventListener('click', function(e) {
        if (e.target.classList.contains('complete-task-btn')) {
            const button = e.target;
            const taskId = button.dataset.taskId;
            const reward = parseInt(button.dataset.reward, 10);

            // Here you might show a different type of ad or confirmation
            // For now, we use the same ad logic
            show_9724340().then(() => {
                currentUserData.balance += reward;
                currentUserData.totalEarned += reward;
                currentUserData.tasksCompleted++;
                if (!currentUserData.completedTasks) currentUserData.completedTasks = {};
                currentUserData.completedTasks[taskId] = true;

                database.ref('users/' + userId).update({
                    balance: currentUserData.balance,
                    totalEarned: currentUserData.totalEarned,
                    tasksCompleted: currentUserData.tasksCompleted,
                    [`completedTasks/${taskId}`]: true
                });
                
                button.textContent = 'Completed';
                button.disabled = true;
                updateAllStatsUI();
                showSuccessPopup(`Task complete! You earned ${reward} Rs!`);
            });
        }
    });
    
    elements.requestWithdrawalBtn.addEventListener('click', function() {
        const amount = parseInt(document.getElementById('withdraw-amount').value, 10);
        const address = document.getElementById('withdrawal-address').value;

        if (!amount || !address.trim()) { alert("Please enter a valid amount and UPI address."); return; }
        if (amount < 250) { alert("Minimum withdrawal amount is 250 Rs."); return; }
        if (amount > currentUserData.balance) { alert("Insufficient balance."); return; }

        const newBalance = currentUserData.balance - amount;
        const withdrawalRequest = {
            userId: userId, userName: currentUserData.name, amount: amount,
            address: address, status: 'pending', timestamp: new Date().toISOString()
        };
        const updates = {};
        updates['/withdrawals/' + database.ref().child('withdrawals').push().key] = withdrawalRequest;
        updates['/users/' + userId + '/balance'] = newBalance;

        database.ref().update(updates).then(() => {
            currentUserData.balance = newBalance;
            updateAllStatsUI();
            showSuccessPopup("Withdrawal request submitted successfully!");
            document.getElementById('withdraw-amount').value = '';
            document.getElementById('withdrawal-address').value = '';
        }).catch(handleFirebaseError);
    });

    elements.popupCloseBtn.addEventListener('click', hideSuccessPopup);

    // Initial Setup
    updateAllStatsUI();
    handleDailyCheckin();
    renderWithdrawalHistory();
    renderDynamicTasks();
}
