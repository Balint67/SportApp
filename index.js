// Data Management
const STORAGE_CHALLENGES_KEY = 'sportChallenges';
const STORAGE_WORKOUTS_KEY = 'sportWorkouts';
const STORAGE_PROFILE_KEY = 'sportProfile';
const STORAGE_AUTH_USER_KEY = 'sportAuthUserId';

function getDefaultProfile() {
    return {
        username: 'Athlete',
        email: '',
        points: 0,
        shields: 0,
        unlockedBadges: [],
        milestones: [],
        createdAt: new Date().toISOString()
    };
}

function recordMilestone(type, title, description = '', saveImmediately = true) {
    const milestone = {
        id: `${type}-${Date.now()}`,
        type,
        title,
        description,
        createdAt: new Date().toISOString()
    };

    const existingMilestones = Array.isArray(userProfile.milestones) ? userProfile.milestones : [];
    userProfile.milestones = [milestone, ...existingMilestones].slice(0, 50);

    if (saveImmediately) {
        saveProfile();
    }
}

function getStorageKey(baseKey) {
    return userId ? `${baseKey}:${userId}` : baseKey;
}

let challenges = [];
let workouts = [];
let selectedDays = []; // For day picker in modal
let userProfile = getDefaultProfile();
let userId = null;
let useFirestore = false;

// Ghost Mode Variables
let ghostModeWorkout = null;
let workoutStartTime = null;
let workoutTimerInterval = null;
let ghostModePerformance = {
    startTime: null,
    endTime: null,
    duration: 0,
    reps: ''
};

const CHALLENGE_SUGGESTIONS = [
    { name: '100 Push-Ups a Day', details: 'Accumulate 100 push-ups daily in as many sets as needed.' },
    { name: '20 Pull-Ups Mission', details: 'Hit 20 clean pull-ups every day with strict form.' },
    { name: 'Plank Ladder', details: 'Hold a total of 5 minutes of planks each day.' },
    { name: 'Squat Century', details: 'Complete 100 bodyweight squats before the day ends.' },
    { name: '10k Steps Streak', details: 'Walk at least 10,000 steps every single day.' },
    { name: 'Mobility Reset', details: 'Spend 15 minutes daily on hips, shoulders, and back mobility.' },
    { name: 'Core Crusher', details: 'Do 3 rounds of 20 sit-ups, 20 leg raises, and a 60-second plank.' },
    { name: 'Burpee Burner', details: 'Complete 50 burpees per day and track your streak.' },
    { name: 'Jump Rope Daily', details: 'Hit 1,000 jump-rope skips every day.' },
    { name: 'Lunge Line', details: 'Do 60 walking lunges a day, keeping each rep controlled.' }
];

const WORKOUT_SUGGESTIONS = [
    { name: 'Personal Workout', details: 'Create your own workout style from scratch.', custom: true },
    { name: 'Bodyweight Training', details: 'Customize with movements like push-ups, squats, lunges, planks, or burpees.' },
    { name: 'Dumbbell Workout', details: 'Add your preferred dumbbell exercises, sets, reps, or muscle groups.' },
    { name: 'Run', details: 'Pick a distance, pace goal, or time target later.' },
    { name: 'Walk', details: 'Set a distance, step goal, or easy recovery duration.' },
    { name: 'Cycling', details: 'Customize with distance, duration, or interval segments.' },
    { name: 'Mobility Session', details: 'Focus on stretching, hips, shoulders, back, or full-body recovery.' },
    { name: 'Core Workout', details: 'Build your own abs and core routine with time or rep targets.' },
    { name: 'Upper Body Workout', details: 'Choose your exercises for chest, back, shoulders, and arms.' },
    { name: 'Lower Body Workout', details: 'Customize a legs session with squats, lunges, hinges, or calf work.' },
    { name: 'HIIT Session', details: 'Set work and rest intervals, then choose your favorite exercises.' }
];

// Firebase Integration Functions
async function initializeAppForUser(user) {
    userId = user.uid;
    useFirestore = true;
    localStorage.setItem(STORAGE_AUTH_USER_KEY, user.uid);
    
    // Load user data from Firestore
    try {
        await loadProfileFromFirestore();
        await loadChallengesFromFirestore();
        await loadWorkoutsFromFirestore();
    } catch (error) {
        console.error('Error loading from Firestore:', error);
        // Fall back to localStorage
        loadChallenges();
        loadWorkouts();
        loadProfile();
    }
    
    renderChallenges();
    renderWorkouts();
    updateProfileCard();
}

function cleanupOnLogout() {
    // Reset all user data
    userId = null;
    useFirestore = false;
    challenges = [];
    workouts = [];
    selectedDays = [];
    userProfile = getDefaultProfile();
    localStorage.removeItem(STORAGE_AUTH_USER_KEY);
    updateProfileCard();
    renderChallenges();
    renderWorkouts();
}

async function loadProfileFromFirestore() {
    if (!userId || !window.db) return;
    try {
        const { doc, getDoc } = window.Firebase;
        const userDocRef = doc(window.db, 'users', userId);
        const docSnap = await getDoc(userDocRef);
        
        if (docSnap.exists()) {
            userProfile = {
                ...getDefaultProfile(),
                ...docSnap.data()
            };
            userProfile.unlockedBadges = Array.isArray(userProfile.unlockedBadges) ? userProfile.unlockedBadges : [];
            userProfile.milestones = Array.isArray(userProfile.milestones) ? userProfile.milestones : [];
        } else {
            // Create new user profile
            await saveProfileToFirestore();
        }
        localStorage.setItem(getStorageKey(STORAGE_PROFILE_KEY), JSON.stringify(userProfile));
    } catch (error) {
        console.error('Error loading profile from Firestore:', error);
        // Fall back to localStorage
        loadProfile();
    }
}

async function saveProfileToFirestore() {
    if (!userId || !window.db) return;
    try {
        // Update userProfile with current challenges and workouts
        userProfile.challenges = challenges;
        userProfile.workouts = workouts;
        
        const { doc, setDoc } = window.Firebase;
        const userDocRef = doc(window.db, 'users', userId);
        await setDoc(userDocRef, userProfile, { merge: true });
    } catch (error) {
        console.error('Error saving profile to Firestore:', error);
    }
}

async function loadChallengesFromFirestore() {
    if (!userId || !window.db) return;
    try {
        // Get challenges from user profile document
        if (userProfile && userProfile.challenges) {
            challenges = userProfile.challenges;
        } else {
            challenges = [];
        }
        localStorage.setItem(getStorageKey(STORAGE_CHALLENGES_KEY), JSON.stringify(challenges));
    } catch (error) {
        console.error('Error loading challenges from Firestore:', error);
        loadChallenges();
    }
}

async function loadWorkoutsFromFirestore() {
    if (!userId || !window.db) return;
    try {
        // Get workouts from user profile document
        if (userProfile && userProfile.workouts) {
            workouts = userProfile.workouts;
        } else {
            workouts = [];
        }
        localStorage.setItem(getStorageKey(STORAGE_WORKOUTS_KEY), JSON.stringify(workouts));
    } catch (error) {
        console.error('Error loading workouts from Firestore:', error);
        loadWorkouts();
    }
}

async function saveChallengesToFirestore() {
    if (!userId || !window.db) return;
    try {
        const { doc, setDoc } = window.Firebase;
        const userDocRef = doc(window.db, 'users', userId);
        await setDoc(userDocRef, { challenges }, { merge: true });
    } catch (error) {
        console.error('Error saving challenges to Firestore:', error);
    }
}

async function saveWorkoutsToFirestore() {
    if (!userId || !window.db) return;
    try {
        const { doc, setDoc } = window.Firebase;
        const userDocRef = doc(window.db, 'users', userId);
        await setDoc(userDocRef, { workouts }, { merge: true });
    } catch (error) {
        console.error('Error saving workouts to Firestore:', error);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadChallenges();
    loadWorkouts();
    loadProfile();
    renderChallenges();
    renderWorkouts();
    updateProfileCard();
    renderSuggestionOptions('challenge');
    renderSuggestionOptions('workout');

    // Event delegation for challenge calendar days
    document.getElementById('challengesList').addEventListener('click', (e) => {
        if (e.target.classList.contains('calendar-day') && e.target.hasAttribute('data-challenge-id')) {
            const challengeId = parseInt(e.target.getAttribute('data-challenge-id'));
            const dateStr = e.target.getAttribute('data-date');
            toggleChallengeDay(challengeId, dateStr);
        }
    });

    // Event delegation for workout calendar days
    document.getElementById('workoutsList').addEventListener('click', (e) => {
        if (e.target.classList.contains('calendar-day') && e.target.hasAttribute('data-workout-id')) {
            const workoutId = parseInt(e.target.getAttribute('data-workout-id'));
            const dateStr = e.target.getAttribute('data-date');
            toggleWorkoutDay(workoutId, dateStr);
        }
    });

    // Day picker event delegation
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('day-btn') && e.target.parentElement.classList.contains('day-picker')) {
            e.preventDefault();
            const day = parseInt(e.target.getAttribute('data-day'));
            toggleDaySelection(day);
        }
    });

    // Modal close handlers
    setupModalHandlers();
});

// Load challenges from localStorage
function loadChallenges() {
    const stored = localStorage.getItem(getStorageKey(STORAGE_CHALLENGES_KEY));
    challenges = stored ? JSON.parse(stored) : [];
}

// Save challenges to localStorage
function saveChallenges() {
    localStorage.setItem(getStorageKey(STORAGE_CHALLENGES_KEY), JSON.stringify(challenges));
    
    // Also save to Firestore if available
    if (useFirestore && userId && window.db) {
        saveChallengesToFirestore().catch(error => {
            console.error('Error saving challenges to Firestore:', error);
        });
    }
}

// Load workouts from localStorage
function loadWorkouts() {
    const stored = localStorage.getItem(getStorageKey(STORAGE_WORKOUTS_KEY));
    workouts = stored ? JSON.parse(stored) : [];
}

// Save workouts to localStorage
function saveWorkouts() {
    localStorage.setItem(getStorageKey(STORAGE_WORKOUTS_KEY), JSON.stringify(workouts));
    
    // Also save to Firestore if available
    if (useFirestore && userId && window.db) {
        saveWorkoutsToFirestore().catch(error => {
            console.error('Error saving workouts to Firestore:', error);
        });
    }
}

// Load user profile from localStorage
function loadProfile() {
    const stored = localStorage.getItem(getStorageKey(STORAGE_PROFILE_KEY));
    if (stored) {
        userProfile = {
            ...getDefaultProfile(),
            ...JSON.parse(stored)
        };
    } else {
        userProfile = getDefaultProfile();
    }
    userProfile.unlockedBadges = Array.isArray(userProfile.unlockedBadges) ? userProfile.unlockedBadges : [];
    userProfile.milestones = Array.isArray(userProfile.milestones) ? userProfile.milestones : [];
}

// Save user profile to localStorage and Firestore
function saveProfile() {
    localStorage.setItem(getStorageKey(STORAGE_PROFILE_KEY), JSON.stringify(userProfile));
    
    // Also save to Firestore if available
    if (useFirestore && userId && window.db) {
        saveProfileToFirestore().catch(error => {
            console.error('Error saving profile to Firestore:', error);
        });
    }
}

function getSuggestionsByType(type) {
    return type === 'challenge' ? CHALLENGE_SUGGESTIONS : WORKOUT_SUGGESTIONS;
}

function renderSuggestionOptions(type) {
    const container = document.getElementById(type === 'challenge' ? 'challengeSuggestions' : 'workoutSuggestions');
    if (!container) return;

    container.innerHTML = getSuggestionsByType(type)
        .map((suggestion, index) => `
            <button
                type="button"
                class="suggestion-chip${suggestion.custom ? ' suggestion-chip-custom' : ''}"
                data-suggestion-type="${type}"
                data-suggestion-index="${index}"
                onclick="applySuggestion('${type}', ${index})"
            >
                ${suggestion.custom ? '<span class="suggestion-plus">+</span>' : ''}
                <span class="suggestion-title">${suggestion.name}</span>
                <span class="suggestion-text">${suggestion.details}</span>
            </button>
        `)
        .join('');
}

function clearSuggestionSelection(type) {
    document
        .querySelectorAll(`.suggestion-chip[data-suggestion-type="${type}"]`)
        .forEach(button => button.classList.remove('active'));
}

function applySuggestion(type, index) {
    const suggestion = getSuggestionsByType(type)[index];
    if (!suggestion) return;

    if (type === 'challenge') {
        document.getElementById('challengeName').value = suggestion.name;
        document.getElementById('challengeDetails').value = suggestion.details;
    } else {
        document.getElementById('workoutName').value = suggestion.custom ? '' : suggestion.name;
        document.getElementById('workoutDetails').value = suggestion.custom ? '' : suggestion.details;
    }

    clearSuggestionSelection(type);

    const activeButton = document.querySelector(`.suggestion-chip[data-suggestion-type="${type}"][data-suggestion-index="${index}"]`);
    if (activeButton) {
        activeButton.classList.add('active');
    }
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
    recordMilestone('challenge-created', `Created challenge "${name}"`, details || 'A new challenge is ready to track.');
    saveChallenges();
    renderChallenges();

    // Reset form and close modal
    document.getElementById('createChallengeForm').reset();
    clearSuggestionSelection('challenge');
    closeCreateModal('challenge');
}

// Create new workout
function createWorkout(event) {
    event.preventDefault();

    const name = document.getElementById('workoutName').value;
    const details = document.getElementById('workoutDetails').value;
    const color = document.querySelector('input[name="workout-color"]:checked').value;

    if (!name.trim() || selectedDays.length === 0) {
        alert('Please select at least one workout day');
        return;
    }

    const workout = {
        id: Date.now(),
        name,
        details,
        color,
        selectedDays: [...selectedDays], // Array of day numbers (0-6)
        createdDate: new Date().toISOString(),
        completedDates: {},
        performances: [] // Array of {date, duration, reps}
    };

    workouts.push(workout);
    recordMilestone(
        'workout-created',
        `Created workout "${name}"`,
        `Scheduled on ${getWorkoutDayNames([...selectedDays]).join(', ')}`
    );
    saveWorkouts();
    renderWorkouts();

    // Reset form and close modal
    selectedDays = [];
    document.getElementById('createWorkoutForm').reset();
    document.querySelectorAll('.day-btn').forEach(btn => btn.classList.remove('selected'));
    clearSuggestionSelection('workout');
    closeCreateModal('workout');
}

// Delete challenge
function deleteChallenge(id) {
    if (confirm('Delete this challenge?')) {
        challenges = challenges.filter(c => c.id !== id);
        saveChallenges();
        renderChallenges();
    }
}

// Delete workout
function deleteWorkout(id) {
    if (confirm('Delete this workout?')) {
        workouts = workouts.filter(w => w.id !== id);
        saveWorkouts();
        renderWorkouts();
    }
}

// Toggle day completion for challenge
function toggleChallengeDay(challengeId, dateStr) {
    const challenge = challenges.find(c => c.id === challengeId);
    if (challenge) {
        if (challenge.completedDates[dateStr]) {
            delete challenge.completedDates[dateStr];
        } else {
            challenge.completedDates[dateStr] = true;
            // Award points when marking as complete
            const streak = getChallengeStreak(challenge);
            const points = calculatePoints('challenge', streak);
            addPoints(points);
            recordMilestone('challenge-complete', `Completed "${challenge.name}"`, `${dateStr} completion saved with a ${streak}-day streak.`);
        }
        saveChallenges();
        renderChallenges();
    }
}

// Toggle day completion for workout
function toggleWorkoutDay(workoutId, dateStr) {
    const workout = workouts.find(w => w.id === workoutId);
    if (workout) {
        if (workout.completedDates[dateStr]) {
            delete workout.completedDates[dateStr];
        } else {
            workout.completedDates[dateStr] = true;
            // Award points when marking as complete
            const streak = getWorkoutStreak(workout);
            const points = calculatePoints('workout', streak);
            addPoints(points);
            recordMilestone('workout-complete', `Completed workout "${workout.name}"`, `${dateStr} completion saved with a ${streak}-day streak.`);
        }
        saveWorkouts();
        renderWorkouts();
    }
}

// Calculate streak for challenge (all days)
function getChallengeStreak(challenge) {
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

// Calculate streak for workout (only selected days count)
function getWorkoutStreak(workout) {
    const today = getDateString(new Date());
    let streak = 0;
    let currentDate = new Date();
    let consecutiveWeeks = true;

    while (consecutiveWeeks) {
        const dateStr = getDateString(currentDate);
        const dayOfWeek = currentDate.getDay();

        // Check if this day is a selected day for the workout
        if (workout.selectedDays.includes(dayOfWeek)) {
            if (workout.completedDates[dateStr]) {
                streak++;
            } else if (dateStr !== today) {
                // Missed a selected day - streak breaks
                break;
            }
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
    const empty = document.getElementById('emptyChallengesState');

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
                <button class="btn-delete" data-id="${challenge.id}" onclick="deleteChallenge(${challenge.id})">🗑️</button>
            </div>

            <div class="streak-container">
                <span class="streak-count">${getChallengeStreak(challenge)}</span>
                <span class="streak-label">day streak 🔥</span>
            </div>

            ${renderCalendar(challenge, 'challenge')}
        </div>
    `).join('');
}

// Render all workouts
function renderWorkouts() {
    const list = document.getElementById('workoutsList');
    const empty = document.getElementById('emptyWorkoutsState');

    if (workouts.length === 0) {
        list.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';

    list.innerHTML = workouts.map(workout => `
        <div class="workout-card" style="border-left-color: ${workout.color}">
            <div class="challenge-header">
                <div class="challenge-title">
                    <h3>${workout.name}</h3>
                    <p class="challenge-details">${workout.details}</p>
                    <p class="challenge-details" style="font-size: 12px; margin-top: 4px;">
                        Days: ${getWorkoutDayNames(workout.selectedDays).join(', ')}
                    </p>
                </div>
                <button class="btn-delete" onclick="deleteWorkout(${workout.id})">🗑️</button>
            </div>

            <div class="streak-container">
                <span class="streak-count">${getWorkoutStreak(workout)}</span>
                <span class="streak-label">streak 🔥</span>
            </div>

            <button class="start-workout-btn" onclick="startGhostMode(${workout.id})">👻 Start Workout</button>

            ${renderCalendar(workout, 'workout')}
        </div>
    `).join('');
}

// Render calendar for a challenge or workout
function renderCalendar(item, type) {
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
        const dayOfWeek = date.getDay();
        const isCompleted = item.completedDates[dateStr];
        const isToday = dateStr === today;
        const isOtherMonth = !isCurrentMonth;

        // For workouts, only show days that are selected for the workout
        let isSelectedDay = true;
        if (type === 'workout') {
            isSelectedDay = item.selectedDays.includes(dayOfWeek);
        }

        let className = 'calendar-day';
        if (isCompleted) className += ' completed';
        if (isToday) className += ' today';
        if (isOtherMonth) className += ' other-month';
        if (type === 'workout' && !isSelectedDay) className += ' other-month'; // Gray out non-selected days

        const dayNum = date.getDate();
        const dataAttr = type === 'challenge' 
            ? `data-challenge-id="${item.id}" data-date="${dateStr}"`
            : `data-workout-id="${item.id}" data-date="${dateStr}"`;
        const onClickAttr = (isOtherMonth || (type === 'workout' && !isSelectedDay)) ? '' : dataAttr;

        calendarHTML += `
            <div class="${className}" ${onClickAttr}>
                ${isCompleted ? '✓' : dayNum}
            </div>
        `;
    }

    calendarHTML += '</div>';

    return calendarHTML;
}

// Get friendly names for workout days
function getWorkoutDayNames(selectedDays) {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return selectedDays.sort((a, b) => a - b).map(day => dayNames[day]);
}

// Toggle day selection in the day picker
function toggleDaySelection(day) {
    const index = selectedDays.indexOf(day);
    if (index > -1) {
        selectedDays.splice(index, 1);
    } else {
        selectedDays.push(day);
    }
    // Update UI
    updateDayPickerUI();
}

// Update day picker UI
function updateDayPickerUI() {
    document.querySelectorAll('.day-btn').forEach(btn => {
        const day = parseInt(btn.getAttribute('data-day'));
        if (selectedDays.includes(day)) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });
}

// Modal functions
function openCreateModal(type) {
    if (type === 'challenge') {
        clearSuggestionSelection('challenge');
        document.getElementById('createChallengeModal').classList.add('active');
    } else if (type === 'workout') {
        selectedDays = [];
        updateDayPickerUI();
        clearSuggestionSelection('workout');
        document.getElementById('createWorkoutModal').classList.add('active');
    }
}

function closeCreateModal(type) {
    if (type === 'challenge') {
        document.getElementById('createChallengeModal').classList.remove('active');
    } else if (type === 'workout') {
        document.getElementById('createWorkoutModal').classList.remove('active');
    }
}

// Setup modal close handlers
function setupModalHandlers() {
    // Close modals when clicking outside
    document.addEventListener('click', (e) => {
        const challengeModal = document.getElementById('createChallengeModal');
        const workoutModal = document.getElementById('createWorkoutModal');

        if (e.target === challengeModal) {
            closeCreateModal('challenge');
        }
        if (e.target === workoutModal) {
            closeCreateModal('workout');
        }
    });

    // Close modals with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeCreateModal('challenge');
            closeCreateModal('workout');
        }
    });
}

// Switch between tabs
function switchTab(tab) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(t => {
        t.classList.remove('active');
    });
    document.querySelectorAll('.nav-tab').forEach(t => {
        t.classList.remove('active');
    });

    // Show selected tab
    if (tab === 'challenges') {
        document.getElementById('challengesTab').classList.add('active');
        document.querySelector('[onclick="switchTab(\'challenges\')"]').classList.add('active');
    } else if (tab === 'workouts') {
        document.getElementById('workoutsTab').classList.add('active');
        document.querySelector('[onclick="switchTab(\'workouts\')"]').classList.add('active');
    }
}

// ============================================
// GHOST MODE - Racing Against Your Personal Best
// ============================================

// Format time from seconds to MM:SS
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${String(secs).padStart(2, '0')}`;
}

// Get previous best performance for a workout
function getBestPerformance(workoutId) {
    const workout = workouts.find(w => w.id === workoutId);
    if (!workout || !workout.performances || workout.performances.length === 0) {
        return null;
    }
    // Return the performance with the shortest duration
    return workout.performances.reduce((best, current) => {
        return (!best || current.duration < best.duration) ? current : best;
    });
}

// Start ghost mode racing
function startGhostMode(workoutId) {
    ghostModeWorkout = workouts.find(w => w.id === workoutId);
    if (!ghostModeWorkout) return;

    // Initialize performance object
    ghostModePerformance = {
        startTime: null,
        endTime: null,
        duration: 0,
        reps: ''
    };

    // Set up the modal
    document.getElementById('ghostWorkoutName').textContent = ghostModeWorkout.name;
    document.getElementById('ghostWorkoutDetails').textContent = ghostModeWorkout.details;
    document.getElementById('repsInput').value = '';
    document.getElementById('currentTime').textContent = '0:00';

    // Get best performance
    const bestPerf = getBestPerformance(workoutId);
    if (bestPerf) {
        document.getElementById('ghostBestTime').textContent = formatTime(bestPerf.duration);
    } else {
        document.getElementById('ghostBestTime').textContent = '-- First time! --';
    }

    // Reset progress bars
    document.getElementById('ghostProgress').style.left = '0%';
    document.getElementById('userProgress').style.left = '0%';

    // Show modal
    document.getElementById('ghostModeModal').classList.add('active');
}

// Start the workout timer
function startWorkoutTimer() {
    // Hide start button, show stop button and timer status
    document.querySelector('.btn-ghost-start').style.display = 'none';
    document.querySelector('.btn-ghost-stop').style.display = 'block';
    document.getElementById('timerRunning').style.display = 'block';

    ghostModePerformance.startTime = Date.now();
    let elapsedSeconds = 0;

    // Update timer every 100ms
    workoutTimerInterval = setInterval(() => {
        elapsedSeconds++;
        document.getElementById('currentTime').textContent = formatTime(elapsedSeconds);

        // Update ghost progress comparison
        const bestPerf = getBestPerformance(ghostModeWorkout.id);
        if (bestPerf) {
            // Calculate percentage through the best time
            const progress = Math.min((elapsedSeconds / bestPerf.duration) * 100, 100);
            document.getElementById('userProgress').style.left = progress + '%';
            
            // Ghost is at the best time position
            const ghostPos = (bestPerf.duration / bestPerf.duration) * 100;
            document.getElementById('ghostProgress').style.left = ghostPos + '%';
        } else {
            // No ghost to race - show linear progress
            const progress = Math.min((elapsedSeconds / 60) * 100, 100);
            document.getElementById('userProgress').style.left = progress + '%';
        }
    }, 100);
}

// Stop the timer and show results
function stopWorkoutTimer() {
    if (!workoutTimerInterval) return;

    clearInterval(workoutTimerInterval);
    workoutTimerInterval = null;

    // Hide stop button, show start button
    document.querySelector('.btn-ghost-stop').style.display = 'none';
    document.querySelector('.btn-ghost-start').style.display = 'block';
    document.getElementById('timerRunning').style.display = 'none';

    ghostModePerformance.endTime = Date.now();
    ghostModePerformance.duration = Math.floor((ghostModePerformance.endTime - ghostModePerformance.startTime) / 1000);
    ghostModePerformance.reps = document.getElementById('repsInput').value;

    // Show results
    showGhostResults();
}

// Show workout results and comparison with ghost
function showGhostResults() {
    const bestPerf = getBestPerformance(ghostModeWorkout.id);
    const currentDuration = ghostModePerformance.duration;
    const currentReps = ghostModePerformance.reps;

    let resultsHTML = '';
    let isBetter = false;

    if (bestPerf) {
        const timeDiff = currentDuration - bestPerf.duration;
        const timeDiffStr = formatTime(Math.abs(timeDiff));
        isBetter = timeDiff < 0;

        resultsHTML = `
            <div class="result-badge ${isBetter ? 'beaten' : ''}">
                ${isBetter ? '🏆 YOU BEAT YOUR GHOST!' : '👻 GHOST IS STILL FASTER'}
            </div>
            
            <div class="result-message">
                ${isBetter 
                    ? `⚡ You were <strong>${timeDiffStr}</strong> faster!` 
                    : `⏱️ You were <strong>${timeDiffStr}</strong> slower`
                }
            </div>

            <div class="result-stats">
                <div class="result-stat">
                    <div class="result-stat-label">👻 Your Ghost</div>
                    <div class="result-stat-value">${formatTime(bestPerf.duration)}</div>
                </div>
                <div class="result-stat">
                    <div class="result-stat-label">🏃 This Attempt</div>
                    <div class="result-stat-value">${formatTime(currentDuration)}</div>
                </div>
            </div>
        `;
    } else {
        resultsHTML = `
            <div class="result-badge">
                🎉 FIRST WORKOUT!
            </div>
            
            <div class="result-message">
                Great job! This is now your personal best to beat.
            </div>

            <div class="result-stats">
                <div class="result-stat">
                    <div class="result-stat-label">⏱️ Your Time</div>
                    <div class="result-stat-value">${formatTime(currentDuration)}</div>
                </div>
                ${currentReps ? `
                <div class="result-stat">
                    <div class="result-stat-label">💪 Reps</div>
                    <div class="result-stat-value">${currentReps}</div>
                </div>
                ` : ''}
            </div>
        `;
    }

    if (isBetter) {
        resultsHTML += `
            <div class="new-personal-best show">
                🌟 NEW PERSONAL BEST! 🌟
            </div>
        `;
    }

    resultsHTML += `
        <button class="btn-mark-complete" onclick="finishWorkout()">✓ Mark Workout Complete</button>
    `;

    document.getElementById('ghostResultsContent').innerHTML = resultsHTML;
    document.getElementById('ghostModeModal').classList.remove('active');
    document.getElementById('ghostResultsModal').classList.add('active');
}

// Save the workout performance and mark day as complete
function finishWorkout() {
    if (!ghostModeWorkout) return;

    // Initialize performances array if it doesn't exist
    if (!ghostModeWorkout.performances) {
        ghostModeWorkout.performances = [];
    }

    // Save the performance
    ghostModeWorkout.performances.push({
        date: new Date().toISOString(),
        duration: ghostModePerformance.duration,
        reps: ghostModePerformance.reps
    });

    // Mark today as completed
    const today = getDateString(new Date());
    ghostModeWorkout.completedDates[today] = true;

    // Award points for ghost mode workout
    const streak = getWorkoutStreak(ghostModeWorkout);
    const points = calculatePoints('workout', streak);
    addPoints(points);
    recordMilestone(
        'ghost-workout',
        `Finished Ghost Mode for "${ghostModeWorkout.name}"`,
        `Time: ${formatTime(ghostModePerformance.duration)}${ghostModePerformance.reps ? `, Reps: ${ghostModePerformance.reps}` : ''}.`
    );

    saveWorkouts();
    renderWorkouts();
    closeGhostResults();
}

// Close ghost mode modal
function closeGhostMode() {
    if (workoutTimerInterval) {
        clearInterval(workoutTimerInterval);
        workoutTimerInterval = null;
    }
    document.querySelector('.btn-ghost-stop').style.display = 'none';
    document.querySelector('.btn-ghost-start').style.display = 'block';
    document.getElementById('timerRunning').style.display = 'none';
    document.getElementById('ghostModeModal').classList.remove('active');
    ghostModeWorkout = null;
}

// Cancel ghost mode without saving
function cancelGhostMode() {
    closeGhostMode();
}

// Close ghost results modal
function closeGhostResults() {
    document.getElementById('ghostResultsModal').classList.remove('active');
    ghostModeWorkout = null;
}

// ============================================
// POINTS & ACHIEVEMENTS SYSTEM
// ============================================

// Badge definitions with unlock conditions
const BADGES = {
    // Streak-based badges
    'power-3': {
        name: 'Power 3',
        icon: '⚡',
        description: 'Achieve a 3-day streak',
        condition: (type, streak) => streak >= 3 && type === 'any',
        rarity: 'common'
    },
    'power-7': {
        name: 'Power 7',
        icon: '🔥',
        description: 'Achieve a 7-day streak',
        condition: (type, streak) => streak >= 7 && type === 'any',
        rarity: 'uncommon'
    },
    'power-10': {
        name: 'Power 10',
        icon: '💪',
        description: 'Achieve a 10-day streak',
        condition: (type, streak) => streak >= 10 && type === 'any',
        rarity: 'uncommon'
    },
    'fortress': {
        name: 'Fortress',
        icon: '🏰',
        description: 'Achieve a 14-day streak',
        condition: (type, streak) => streak >= 14 && type === 'any',
        rarity: 'rare'
    },
    'three-weeks': {
        name: 'Three Weeks',
        icon: '🏆',
        description: 'Achieve a 21-day streak',
        condition: (type, streak) => streak >= 21 && type === 'any',
        rarity: 'rare'
    },
    'month-of-iron': {
        name: 'Month of Iron',
        icon: '⚒️',
        description: 'Achieve a 30-day streak',
        condition: (type, streak) => streak >= 30 && type === 'any',
        rarity: 'epic'
    },
    'legend': {
        name: 'Legend',
        icon: '👑',
        description: 'Achieve a 50-day streak',
        condition: (type, streak) => streak >= 50 && type === 'any',
        rarity: 'epic'
    },
    'unstoppable': {
        name: 'Unstoppable',
        icon: '💎',
        description: 'Achieve a 100-day streak',
        condition: (type, streak) => streak >= 100 && type === 'any',
        rarity: 'legendary'
    },
    
    // Workout-specific badges
    'first-ghost': {
        name: 'Ghost Racer',
        icon: '👻',
        description: 'Complete your first Ghost Mode workout',
        condition: (type, workoutCount) => workoutCount >= 1 && type === 'workout-first',
        rarity: 'common'
    },
    'beat-ghost': {
        name: 'Ghost Buster',
        icon: '⚡👻',
        description: 'Beat your personal best in Ghost Mode',
        condition: (type, beatenGhost) => beatenGhost === true && type === 'ghost-beaten',
        rarity: 'uncommon'
    },
    
    // Challenge-specific badges
    'challenge-master': {
        name: 'Challenge Master',
        icon: '🎯',
        description: 'Complete 10 different challenges',
        condition: (type, count) => count >= 10 && type === 'challenges-total',
        rarity: 'uncommon'
    },
    
    // Points-based badges
    'first-points': {
        name: 'Starter Pack',
        icon: '🎁',
        description: 'Earn 100 points',
        condition: (type, points) => points >= 100 && type === 'points',
        rarity: 'common'
    },
    'point-collector': {
        name: 'Point Collector',
        icon: '💰',
        description: 'Earn 500 points',
        condition: (type, points) => points >= 500 && type === 'points',
        rarity: 'uncommon'
    },
    'wealth': {
        name: 'Wealth',
        icon: '🏦',
        description: 'Earn 1000 points',
        condition: (type, points) => points >= 1000 && type === 'points',
        rarity: 'rare'
    }
};

// Avatar evolution stages
const AVATAR_STAGES = [
    { points: 0, icon: '🥚', name: 'Scout', description: 'Just starting your journey...' },
    { points: 100, icon: '👤', name: 'Adventurer', description: 'You\'re on your way!' },
    { points: 250, icon: '🗡️', name: 'Warrior', description: 'Growing stronger each day' },
    { points: 500, icon: '🏆', name: 'Champion', description: 'You\'re a true athlete!' },
    { points: 1000, icon: '👑', name: 'Titan', description: 'Unstoppable force!' }
];

// Calculate points earned based on activity
function calculatePoints(type, streak) {
    // Base points: 10 for challenge, 20 for workout
    const basePoints = type === 'challenge' ? 10 : 20;
    
    // Streak multiplier
    let multiplier = 1;
    if (streak >= 31) multiplier = 3;      // 31+ days: 3x
    else if (streak >= 15) multiplier = 2;  // 15-30 days: 2x
    else if (streak >= 8) multiplier = 1.5; // 8-14 days: 1.5x
    
    return Math.floor(basePoints * multiplier);
}

// Add points to profile
function addPoints(amount, reason = '') {
    userProfile.points += amount;
    saveProfile();
    updateProfileCard();
    
    // Check for new badges
    checkNewBadges();
}

// Get current avatar based on points
function getAvatarStage(points) {
    for (let i = AVATAR_STAGES.length - 1; i >= 0; i--) {
        if (points >= AVATAR_STAGES[i].points) {
            return AVATAR_STAGES[i];
        }
    }
    return AVATAR_STAGES[0];
}

// Update profile card with current stats
function updateProfileCard() {
    const avatar = getAvatarStage(userProfile.points);
    
    document.getElementById('avatarIcon').textContent = avatar.icon;
    document.getElementById('avatarRank').textContent = avatar.name;
    document.getElementById('totalPoints').textContent = userProfile.points;
    document.getElementById('shieldCount').textContent = userProfile.shields;
    document.getElementById('badgeCount').textContent = userProfile.unlockedBadges.length;

    const profileName = document.getElementById('profileName');
    const profileEmail = document.getElementById('profileEmail');
    const profileMemberSince = document.getElementById('profileMemberSince');

    if (profileName) {
        profileName.textContent = userProfile.username || 'Athlete';
    }
    if (profileEmail) {
        profileEmail.textContent = userProfile.email || '';
    }
    if (profileMemberSince) {
        profileMemberSince.textContent = userProfile.createdAt
            ? `Member since ${new Date(userProfile.createdAt).toLocaleDateString()}`
            : '';
    }
}

// Open profile modal
function openProfileModal() {
    const avatar = getAvatarStage(userProfile.points);
    const nextStage = AVATAR_STAGES.find(s => s.points > userProfile.points);
    
    // Update large avatar and rank
    document.getElementById('profileAvatarIcon').textContent = avatar.icon;
    document.getElementById('profileRankTitle').textContent = avatar.name;
    document.getElementById('profileRankDescription').textContent = avatar.description;
    document.getElementById('profilePoints').textContent = userProfile.points;
    document.getElementById('profileShields').textContent = userProfile.shields;
    
    // Update progress to next rank
    if (nextStage) {
        const pointsToNext = nextStage.points - userProfile.points;
        const rangeStart = avatar.points;
        const rangeEnd = nextStage.points;
        const progressRange = rangeEnd - rangeStart;
        const currentProgressRange = userProfile.points - rangeStart;
        const progressPercent = (currentProgressRange / progressRange) * 100;
        
        document.getElementById('rankProgress').style.width = progressPercent + '%';
        document.getElementById('rankProgressText').textContent = 
            `${userProfile.points} / ${nextStage.points} points to ${nextStage.name}`;
    } else {
        document.getElementById('rankProgress').style.width = '100%';
        document.getElementById('rankProgressText').textContent = 'You\'ve reached the maximum rank!';
    }
    
    // Update shield buying button
    const buyBtn = document.querySelector('.btn-buy-shield');
    if (userProfile.points >= 100) {
        buyBtn.disabled = false;
    } else {
        buyBtn.disabled = true;
    }
    
    // Display badges
    renderBadgesDisplay();
    renderMilestones();
    
    document.getElementById('profileModal').classList.add('active');
}

// Close profile modal
function closeProfileModal() {
    document.getElementById('profileModal').classList.remove('active');
}

// Render badges in the profile modal
function renderBadgesDisplay() {
    let badgesHTML = '';
    
    Object.entries(BADGES).forEach(([id, badge]) => {
        const isUnlocked = userProfile.unlockedBadges.includes(id);
        const badgeClass = isUnlocked ? 'badge unlocked' : 'badge locked';
        
        badgesHTML += `
            <div class="${badgeClass}">
                <span class="badge-icon">${badge.icon}</span>
                <span class="badge-name">${badge.name}</span>
                <span class="badge-desc">${badge.description}</span>
            </div>
        `;
    });
    
    document.getElementById('badgesDisplay').innerHTML = badgesHTML;
}

function renderMilestones() {
    const milestonesContainer = document.getElementById('milestonesDisplay');
    if (!milestonesContainer) return;

    const milestones = Array.isArray(userProfile.milestones) ? userProfile.milestones : [];
    if (milestones.length === 0) {
        milestonesContainer.innerHTML = '<p class="milestone-empty">Your milestone history will appear here as you progress.</p>';
        return;
    }

    milestonesContainer.innerHTML = milestones
        .slice(0, 12)
        .map(milestone => `
            <div class="milestone-item">
                <div class="milestone-copy">
                    <strong>${milestone.title}</strong>
                    <p>${milestone.description || ''}</p>
                </div>
                <span class="milestone-date">${new Date(milestone.createdAt).toLocaleDateString()}</span>
            </div>
        `)
        .join('');
}

// Check and unlock new badges
function checkNewBadges() {
    const maxChallengeStreak = challenges.length > 0
        ? Math.max(...challenges.map(challenge => getChallengeStreak(challenge)))
        : 0;
    const maxWorkoutStreak = workouts.length > 0
        ? Math.max(...workouts.map(workout => getWorkoutStreak(workout)))
        : 0;
    const maxStreak = Math.max(maxChallengeStreak, maxWorkoutStreak);
    
    Object.entries(BADGES).forEach(([id, badge]) => {
        if (userProfile.unlockedBadges.includes(id)) return; // Already unlocked
        
        // Check badge condition
        if (badge.condition('any', maxStreak)) {
            userProfile.unlockedBadges.push(id);
            recordMilestone('badge', `Unlocked badge "${badge.name}"`, badge.description, false);
            showBadgeUnlock(id, badge);
        }
    });
    
    // Check points-based badges
    if (!userProfile.unlockedBadges.includes('first-points') && userProfile.points >= 100) {
        userProfile.unlockedBadges.push('first-points');
        recordMilestone('badge', `Unlocked badge "${BADGES['first-points'].name}"`, BADGES['first-points'].description, false);
        showBadgeUnlock('first-points', BADGES['first-points']);
    }
    if (!userProfile.unlockedBadges.includes('point-collector') && userProfile.points >= 500) {
        userProfile.unlockedBadges.push('point-collector');
        recordMilestone('badge', `Unlocked badge "${BADGES['point-collector'].name}"`, BADGES['point-collector'].description, false);
        showBadgeUnlock('point-collector', BADGES['point-collector']);
    }
    if (!userProfile.unlockedBadges.includes('wealth') && userProfile.points >= 1000) {
        userProfile.unlockedBadges.push('wealth');
        recordMilestone('badge', `Unlocked badge "${BADGES['wealth'].name}"`, BADGES['wealth'].description, false);
        showBadgeUnlock('wealth', BADGES['wealth']);
    }
    
    saveProfile();
}

// Show badge unlock notification (could be animated toast)
function showBadgeUnlock(id, badge) {
    console.log(`🎉 Badge Unlocked: ${badge.name}!`);
}

// Buy a shield with points
function buyShield() {
    if (userProfile.points >= 100) {
        userProfile.points -= 100;
        userProfile.shields += 1;
        recordMilestone('shield', 'Bought a streak shield', '100 points exchanged for 1 shield.');
        saveProfile();
        updateProfileCard();
        openProfileModal(); // Refresh the modal
        alert('🛡️ Shield purchased!');
    } else {
        alert('Not enough points! (Need 100, have ' + userProfile.points + ')');
    }
}
