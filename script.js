document.addEventListener('DOMContentLoaded', function() {
    // --- Initialize Telegram Web App ---
    const tg = window.Telegram.WebApp;
    if (!tg || !tg.initDataUnsafe?.user) {
        document.body.innerHTML = "<h1>Error: Please open this app inside Telegram.</h1>";
        return;
    }
    
    tg.ready();
    tg.expand();

    // --- DOM Elements ---
    const loginScreen = document.getElementById('login-screen');
    const appScreen = document.getElementById('app');
    const userDetailsForm = document.getElementById('user-details-form');
    const usernameDisplayElements = document.querySelectorAll('.username');
    const profilePicElements = document.querySelectorAll('.profile-pic');
    const profileIdElement = document.getElementById('profile-user-id');
    const logoutBtn = document.getElementById('logout-btn');

    // --- App State from Telegram ---
    const telegramUser = tg.initDataUnsafe.user;
    const userId = telegramUser.id.toString();

    // --- App Initialization ---
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

    function handleFirebaseError(error) {
        console.error("Firebase error:", error);
        document.body.innerHTML = "<h1>Error connecting to the database. Please try again.</h1>";
    }

    // --- View Functions ---
    function showLoginScreen() {
        loginScreen.style.display = 'flex';
        appScreen.classList.add('hidden');
    }

    function initializeAppView(userData) {
        loginScreen.style.display = 'none';
        appScreen.classList.remove('hidden');

        const userDisplayName = userData.name || `${telegramUser.first_name} ${telegramUser.last_name || ''}`.trim();

        usernameDisplayElements.forEach(el => {
            el.innerHTML = `${userDisplayName} <i class="fas fa-gem diamond"></i>`;
        });

        const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(userDisplayName)}&background=random&color=fff&size=128`;
        profilePicElements.forEach(img => img.src = avatarUrl);

        document.querySelector('.join-date').textContent = `Joined: ${new Date(userData.joinedDate).toLocaleDateString()}`;

        initializeCoreAppLogic(userData);
    }

    // --- Event Handlers ---
    userDetailsForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const mobileNumber = document.getElementById('mobile-number').value;
        if (!mobileNumber.trim()) {
            alert('Please enter your mobile number.'); return;
        }

        const newUserData = {
            name: `${telegramUser.first_name} ${telegramUser.last_name || ''}`.trim(),
            mobile: mobileNumber,
            telegramUsername: telegramUser.username || 'N/A',
            telegramId: userId,
            balance: 0,
            totalEarned: 0,
            tasksCompleted: 0,
            joinedDate: new Date().toISOString()
        };

        database.ref('users/' + userId).set(newUserData).then(() => {
            initializeAppView(newUserData);
        }).catch(handleFirebaseError);
    });
    
    logoutBtn.addEventListener('click', () => {
        if (confirm("Are you sure you want to log out? You will need to enter your mobile number again.")) {
            // A non-destructive logout: we just remove the mobile number
            // which forces the login screen on next open.
            database.ref('users/' + userId + '/mobile').remove();
            alert("You have been logged out.");
            location.reload();
        }
    });

    // --- Start the application ---
    init();
});


// --- Main App Logic ---
function initializeCoreAppLogic(userData) {
    const userId = userData.telegramId;
    let currentUserData = { ...userData }; // Create a local copy to manage state

    // --- DOM Elements for Stats ---
    const balanceElements = document.querySelectorAll('.balance, .balance-badge');
    const statsDailyTasks = document.getElementById('stats-daily-tasks');
    const statsHourlyTasks = document.getElementById('stats-hourly-tasks'); // Placeholder
    const statsLifetimeTasks = document.getElementById('stats-lifetime-tasks');
    const statsTotalEarnings = document.getElementById('stats-total-earnings');
    const profileTotalEarned = document.getElementById('profile-total-earned');
    const profileTasksDone = document.getElementById('profile-tasks-done');
    
    // --- Other DOM Elements ---
    const navItems = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page');
    const startTaskButtons = document.querySelectorAll('.start-task-btn');
    const requestWithdrawalBtn = document.querySelector('.request-withdrawal-btn');
    const successPopup = document.getElementById('success-popup');
    const rewardMessage = document.getElementById('reward-message');
    const popupCloseBtn = document.querySelector('.popup-close');

    // --- Core Functions ---
    function updateAllStatsUI() {
        balanceElements.forEach(el => el.textContent = `Balance: ${currentUserData.balance} Rs`);
        statsDailyTasks.textContent = currentUserData.tasksCompleted; // Simplified for now
        statsHourlyTasks.textContent = currentUserData.tasksCompleted; // Placeholder
        statsLifetimeTasks.textContent = currentUserData.tasksCompleted;
        statsTotalEarnings.textContent = currentUserData.totalEarned;
        profileTasksDone.textContent = currentUserData.tasksCompleted;
        profileTotalEarned.textContent = `${currentUserData.totalEarned} Rs`;
    }

    function showSuccessPopup(message) {
        rewardMessage.textContent = message;
        successPopup.classList.remove('hidden');
    }

    function hideSuccessPopup() {
        successPopup.classList.add('hidden');
    }

    // --- Event Listeners ---
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
            const pageId = this.getAttribute('href').substring(1);
            pages.forEach(page => page.classList.remove('active'));
            document.getElementById(pageId).classList.add('active');
        });
    });

    startTaskButtons.forEach(button => {
        button.addEventListener('click', function() {
            if (typeof show_9724340 === 'function') {
                show_9724340().then(() => {
                    const reward = Math.floor(Math.random() * 4) + 1;
                    
                    // Update local state
                    currentUserData.balance += reward;
                    currentUserData.totalEarned += reward;
                    currentUserData.tasksCompleted++;
                    
                    // Update Firebase
                    database.ref('users/' + userId).update({
                        balance: currentUserData.balance,
                        totalEarned: currentUserData.totalEarned,
                        tasksCompleted: currentUserData.tasksCompleted
                    });
                    
                    updateAllStatsUI();
                    showSuccessPopup(`You earned ${reward} Rs! Your new balance is ${currentUserData.balance} Rs.`);
                }).catch(error => console.error("Ad error:", error));
            } else {
                alert('Ad service is not available.');
            }
        });
    });
    
    requestWithdrawalBtn.addEventListener('click', function() {
        const amount = parseInt(document.getElementById('withdraw-amount').value, 10);
        const address = document.getElementById('withdrawal-address').value;

        if (!amount || !address.trim()) {
            alert("Please enter a valid amount and UPI address."); return;
        }
        if (amount < 250) {
            alert("Minimum withdrawal amount is 250 Rs."); return;
        }
        if (amount > currentUserData.balance) {
            alert("You do not have enough balance to withdraw this amount."); return;
        }

        const withdrawalRequest = {
            userId: userId,
            userName: currentUserData.name,
            amount: amount,
            address: address,
            status: 'pending',
            timestamp: new Date().toISOString()
        };

        database.ref('withdrawals').push(withdrawalRequest).then(() => {
            showSuccessPopup("Your withdrawal request has been submitted successfully!");
            document.getElementById('withdraw-amount').value = '';
            document.getElementById('withdrawal-address').value = '';
        }).catch(handleFirebaseError);
    });

    popupCloseBtn.addEventListener('click', hideSuccessPopup);

    // Initial UI Setup on app load
    updateAllStatsUI();
}