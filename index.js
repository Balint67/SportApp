// Data Management
const STORAGE_KEY = 'sportChallenges';

let challenges = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadChallenges();
    renderChallenges();

    // Event delegation for calendar days
    document.getElementById('challengesList').addEventListener('click', (e) => {
        if (e.target.classList.contains('calendar-day') && e.target.hasAttribute('data-challenge-id')) {
            const challengeId = parseInt(e.target.getAttribute('data-challenge-id'));
            const dateStr = e.target.getAttribute('data-date');
            toggleDay(challengeId, dateStr);
        }
    });
});

// Load challenges from localStorage
function loadChallenges() {
    const stored = localStorage.getItem(STORAGE_KEY);
    challenges = stored ? JSON.parse(stored) : [];
}

// Save challenges to localStorage
function saveChallenges() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(challenges));
}

// Create new challenge
function createChallenge(event) {
    event.preventDefault();

    const name = document.getElementById('challengeName').value;
    const details = document.getElementById('challengeDetails').value;
    const color = document.querySelector('input[name="color"]:checked').value;

    if (!name.trim()) return;

    const challenge = {
        id: Date.now(),
        name,
        details,
        color,
        createdDate: new Date().toISOString(),
        completedDates: {}
    };

    challenges.push(challenge);
    saveChallenges();
    renderChallenges();

    // Reset form and close modal
    document.getElementById('createForm').reset();
    closeCreateModal();
}

// Delete challenge
function deleteChallenge(id) {
    if (confirm('Delete this challenge?')) {
        challenges = challenges.filter(c => c.id !== id);
        saveChallenges();
        renderChallenges();
    }
}

// Toggle day completion
function toggleDay(challengeId, dateStr) {
    const challenge = challenges.find(c => c.id === challengeId);
    if (challenge) {
        if (challenge.completedDates[dateStr]) {
            delete challenge.completedDates[dateStr];
        } else {
            challenge.completedDates[dateStr] = true;
        }
        saveChallenges();
        renderChallenges();
    }
}

// Calculate streak
function getStreak(challenge) {
    const today = getDateString(new Date());
    let streak = 0;
    let currentDate = new Date();

    while (true) {
        const dateStr = getDateString(currentDate);
        if (challenge.completedDates[dateStr]) {
            streak++;
        } else if (dateStr !== today) {
            break;
        }
        currentDate.setDate(currentDate.getDate() - 1);
    }

    return streak;
}

// Get date string (YYYY-MM-DD)
function getDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Get dates for current month
function getMonthDates(year, month) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const dates = [];

    // Previous month's days
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
        const date = new Date(year, month, -i);
        dates.push({
            date,
            isCurrentMonth: false,
            dateStr: getDateString(date)
        });
    }

    // Current month's days
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        dates.push({
            date,
            isCurrentMonth: true,
            dateStr: getDateString(date)
        });
    }

    // Next month's days
    const remainingDays = 42 - dates.length; // 6 weeks * 7 days
    for (let day = 1; day <= remainingDays; day++) {
        const date = new Date(year, month + 1, day);
        dates.push({
            date,
            isCurrentMonth: false,
            dateStr: getDateString(date)
        });
    }

    return dates;
}

// Render all challenges
function renderChallenges() {
    const list = document.getElementById('challengesList');
    const empty = document.getElementById('emptyState');

    if (challenges.length === 0) {
        list.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';

    list.innerHTML = challenges.map(challenge => `
        <div class="challenge-card" style="border-left-color: ${challenge.color}">
            <div class="challenge-header">
                <div class="challenge-title">
                    <h3>${challenge.name}</h3>
                    <p class="challenge-details">${challenge.details}</p>
                </div>
                <button class="btn-delete" data-id="${challenge.id}">🗑️</button>
            </div>

            <div class="streak-container">
                <span class="streak-count">${getStreak(challenge)}</span>
                <span class="streak-label">day streak 🔥</span>
            </div>

            ${renderCalendar(challenge)}
        </div>
    `).join('');

    // Event delegation for delete buttons (clicks anywhere on list, check if delete button)
    list.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.btn-delete');
        if (deleteBtn) {
            const id = parseInt(deleteBtn.getAttribute('data-id'));
            deleteChallenge(id);
        }
    });
}

// Render calendar for a challenge
function renderCalendar(challenge) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });
    const dates = getMonthDates(year, month);
    const today = getDateString(new Date());

    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    let calendarHTML = `
        <div class="month-navigation">
            <span>${monthName}</span>
        </div>
        <div class="calendar-header">
            ${dayLabels.map(day => `<div class="day-label">${day}</div>`).join('')}
        </div>
        <div class="calendar">
    `;

    for (const {date, isCurrentMonth, dateStr} of dates) {
        const isCompleted = challenge.completedDates[dateStr];
        const isToday = dateStr === today;
        const isOtherMonth = !isCurrentMonth;

        let className = 'calendar-day';
        if (isCompleted) className += ' completed';
        if (isToday) className += ' today';
        if (isOtherMonth) className += ' other-month';

        const dayNum = date.getDate();
        const onClickAttr = isOtherMonth ? '' : `data-challenge-id="${challenge.id}" data-date="${dateStr}"`;

        calendarHTML += `
            <div class="${className}" ${onClickAttr}>
                ${isCompleted ? '✓' : dayNum}
            </div>
        `;
    }

    calendarHTML += '</div>';

    return calendarHTML;
}

// Modal functions
function openCreateModal() {
    document.getElementById('createModal').classList.add('active');
}

function closeCreateModal() {
    document.getElementById('createModal').classList.remove('active');
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    const modal = document.getElementById('createModal');
    if (e.target === modal) {
        closeCreateModal();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeCreateModal();
    }
});
