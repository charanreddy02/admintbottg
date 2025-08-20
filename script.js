document.addEventListener('DOMContentLoaded', function() {
    const tg = window.Telegram.WebApp;
    if (!tg || !tg.initDataUnsafe?.user) {
        document.body.innerHTML = "<h1>Error: Please open this app inside Telegram.</h1>"; return;
    }
    tg.ready(); tg.expand();

    const mainLoader = document.getElementById('main-loader');
    const loginScreen = document.getElementById('login-screen');
    const appScreen = document.getElementById('app');
    const userDetailsForm = document.getElementById('user-details-form');
    const telegramUser = tg.initDataUnsafe.user;
    const userId = telegramUser.id.toString();

    function init() {
        const userRef = database.ref('users/' + userId);
        userRef.once('value', (snapshot) => {
            mainLoader.classList.add('hidden'); // Hide loader after check
            if (snapshot.exists() && snapshot.val().mobile) {
                // User exists, check for ban and proceed
                if (snapshot.val().isBanned) {
                    document.body.innerHTML = `
                        <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; text-align: center; padding: 2rem; font-family: sans-serif;">
                            <h2 style="color: #f44336;">Account Suspended</h2>
                            <p>For assistance, please contact customer support:</p>
                            <p><strong>Support: @BinaryMindsetTg</strong></p>
                        </div>
                    `;
                    return;
                }
                userRef.update({ lastSeen: new Date().toISOString() });
                initializeAppView(snapshot.val());
            } else {
                // User is new or hasn't provided mobile
                showLoginScreen();
            }
        }).catch(handleFirebaseError);
    }

    function handleFirebaseError(error) { console.error("Firebase error:", error); document.body.innerHTML = "<h1>Error connecting to the database.</h1>"; }
    
    function showLoginScreen() {
        mainLoader.classList.add('hidden');
        loginScreen.classList.remove('hidden');
        appScreen.classList.add('hidden');
    }

    function initializeAppView(userData) {
        loginScreen.classList.add('hidden');
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
        
        // **CRITICAL FIX**: This logic prevents account resets.
        const userRef = database.ref('users/' + userId);
        userRef.once('value', (snapshot) => {
            if (snapshot.exists()) {
                // User already has data, just update the mobile number
                userRef.update({ mobile: mobileNumber }).then(() => {
                    initializeAppView({ ...snapshot.val(), mobile: mobileNumber });
                }).catch(handleFirebaseError);
            } else {
                // This is a completely new user, create their full profile
                const newUserData = {
                    name: `${telegramUser.first_name} ${telegramUser.last_name || ''}`.trim(),
                    mobile: mobileNumber, telegramUsername: telegramUser.username || 'N/A', telegramId: userId,
                    balance: 0, totalEarned: 0, adTasksCompleted: 0, dynamicTasksCompleted: 0,
                    joinedDate: new Date().toISOString(),
                    lastClaimTimestamp: 0,
                    completedTasks: {}
                };
                userRef.set(newUserData).then(() => initializeAppView(newUserData)).catch(handleFirebaseError);
            }
        });
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
        adTaskBtn: document.querySelector('#ads-task .start-task-btn'),
        requestWithdrawalBtn: document.querySelector('.request-withdrawal-btn'),
        successPopup: document.getElementById('success-popup'),
        rewardMessage: document.getElementById('reward-message'),
        popupCloseBtn: document.querySelector('.popup-close'),
        claimBonusBtn: document.getElementById('claim-bonus-btn'),
        withdrawalHistoryList: document.getElementById('withdrawal-history-list'),
        dynamicTasksList: document.getElementById('dynamic-tasks-list')
    };

    function updateAllStatsUI() {
        const totalTasks = (currentUserData.adTasksCompleted || 0) + (currentUserData.dynamicTasksCompleted || 0);
        elements.balance.forEach(el => el.textContent = `${currentUserData.balance} Rs`);
        elements.statsLifetimeTasks.textContent = currentUserData.adTasksCompleted || 0;
        elements.statsTotalEarnings.textContent = currentUserData.totalEarned || 0;
        elements.profileTasksDone.textContent = totalTasks;
        elements.profileTotalEarned.textContent = `${currentUserData.totalEarned || 0} Rs`;
    }

    function showSuccessPopup(message) { elements.rewardMessage.textContent = message; elements.successPopup.classList.remove('hidden'); }
    function hideSuccessPopup() { elements.successPopup.classList.add('hidden'); }

    function handleDailyCheckin() {
        const lastClaim = currentUserData.lastClaimTimestamp || 0;
        const now = new Date();
        const lastClaimDate = new Date(lastClaim);
        const isSameDay = now.toDateString() === lastClaimDate.toDateString();
        elements.claimBonusBtn.disabled = isSameDay;
        elements.claimBonusBtn.querySelector('span').textContent = isSameDay ? "Claimed Today" : "Claim Reward";
    }
    
    function renderWithdrawalHistory() {
        database.ref('withdrawals').orderByChild('userId').equalTo(userId).on('value', snapshot => {
            elements.withdrawalHistoryList.innerHTML = '';
            if (!snapshot.exists()) { elements.withdrawalHistoryList.innerHTML = '<p class="no-referrals">No withdrawal history found.</p>'; return; }
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
        database.ref('dailyTasks').on('value', snapshot => {
            elements.dynamicTasksList.innerHTML = '';
            if (!snapshot.exists()) { elements.dynamicTasksList.innerHTML = '<p class="no-referrals">No new tasks available today.</p>'; return; }
            const completed = currentUserData.completedTasks || {};
            snapshot.forEach(childSnapshot => {
                const taskId = childSnapshot.key;
                const task = childSnapshot.val();
                if (!task.active) return; // Skip inactive tasks
                const isCompleted = completed[taskId];
                
                const taskItem = document.createElement('div');
                taskItem.className = 'task-item-home';
                taskItem.innerHTML = `
                    <div><h3>${task.title}</h3><p>${task.description}</p></div>
                    <button class="start-task-btn dynamic-task-btn" data-task-id="${taskId}" data-reward="${task.reward}" ${isCompleted ? 'disabled' : ''}>
                        ${isCompleted ? 'Completed' : `+ ${task.reward} ₹`}
                    </button>
                `;
                elements.dynamicTasksList.appendChild(taskItem);
            });
        });
    }

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
        updateAllStatsUI(); handleDailyCheckin(); showSuccessPopup(`You claimed a daily bonus of ${reward} Rs!`);
    });
    
    elements.adTaskBtn.addEventListener('click', function() {
        if (typeof show_9724340 === 'function') {
            show_9724340().then(() => {
                const reward = Math.floor(Math.random() * 5) + 1; // 1-5 Rs
                currentUserData.balance += reward;
                currentUserData.totalEarned += reward;
                currentUserData.adTasksCompleted = (currentUserData.adTasksCompleted || 0) + 1;
                database.ref('users/' + userId).update({
                    balance: currentUserData.balance,
                    totalEarned: currentUserData.totalEarned,
                    adTasksCompleted: currentUserData.adTasksCompleted
                });
                updateAllStatsUI(); showSuccessPopup(`You earned ${reward} Rs for watching an ad!`);
            }).catch(error => console.error("Ad error:", error));
        } else { alert('Ad service is not available.'); }
    });

    elements.dynamicTasksList.addEventListener('click', function(e) {
        if (e.target.classList.contains('dynamic-task-btn')) {
            const button = e.target;
            const taskId = button.dataset.taskId;
            const reward = parseInt(button.dataset.reward, 10);

            // Here you might show a different type of ad or confirmation
            // For now, we assume the task is just to click the button
            button.disabled = true; // Prevent multiple clicks
            
            currentUserData.balance += reward;
            currentUserData.totalEarned += reward;
            currentUserData.dynamicTasksCompleted = (currentUserData.dynamicTasksCompleted || 0) + 1;
            if (!currentUserData.completedTasks) currentUserData.completedTasks = {};
            currentUserData.completedTasks[taskId] = true;

            database.ref('users/' + userId).update({
                balance: currentUserData.balance,
                totalEarned: currentUserData.totalEarned,
                dynamicTasksCompleted: currentUserData.dynamicTasksCompleted,
                [`completedTasks/${taskId}`]: true
            });
            
            button.textContent = 'Completed';
            updateAllStatsUI();
            showSuccessPopup(`Task complete! You earned ${reward} Rs!`);
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

    updateAllStatsUI();
    handleDailyCheckin();
    renderWithdrawalHistory();
    renderDynamicTasks();
}
