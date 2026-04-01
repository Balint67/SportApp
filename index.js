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
let streakIconIdCounter = 0;
let userId = null;
let useFirestore = false;
let activeStreakFireValue = 0;
let leaderboardUsers = [];
let selectedChallengeTrackingMode = 'standard';
let editingChallengeId = null;
let editingWorkoutId = null;

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

const GOAL_CATEGORIES = [
    { id: 'sports', label: 'Sports' },
    { id: 'health', label: 'Health' },
    { id: 'personal-life', label: 'Personal Life' },
    { id: 'self-improvement', label: 'Self Improvement' }
];

const GOAL_SUGGESTIONS = {
    sports: [
        { name: '100 Push-Ups a Day', details: 'Accumulate 100 push-ups daily in as many sets as needed.' },
        { name: '10k Steps Streak', details: 'Walk at least 10,000 steps every single day.' },
        { name: 'Jump Rope Daily', details: 'Hit 1,000 jump-rope skips every day.' },
        { name: 'Mobility Reset', details: 'Spend 15 minutes daily on hips, shoulders, and back mobility.' },
        { name: 'Custom Sports Goal', details: 'Create your own sport or movement habit.', custom: true }
    ],
    health: [
        { name: 'Water Intake Tracker', details: 'Log every glass or bottle and keep a daily water history.', trackingMode: 'water' },
        { name: 'Healthy Meal Check-In', details: 'Track one clean, balanced meal each day.' },
        { name: 'Sleep 8 Hours', details: 'Aim for at least 8 hours of sleep every night.' },
        { name: 'Vitamins Daily', details: 'Take your supplements or vitamins every day.' },
        { name: 'Custom Health Goal', details: 'Create your own health and wellness habit.', custom: true }
    ],
    'personal-life': [
        { name: 'Call Family', details: 'Reach out to a family member or close friend every day.' },
        { name: 'Tidy Your Space', details: 'Spend 10 minutes cleaning or organizing your room.' },
        { name: 'Budget Check', details: 'Review your spending or savings progress each day.' },
        { name: 'Daily Journal', details: 'Write a short personal reflection before the day ends.' },
        { name: 'Custom Personal Goal', details: 'Create your own personal life routine.', custom: true }
    ],
    'self-improvement': [
        { name: 'Read Every Day', details: 'Read at least 20 pages or 15 minutes every day.' },
        { name: 'Study Session', details: 'Complete one focused study block daily.' },
        { name: 'Learn a Language', details: 'Practice vocabulary, listening, or speaking every day.' },
        { name: 'Skill Builder', details: 'Work on coding, music, design, or another skill daily.' },
        { name: 'Custom Self Improvement Goal', details: 'Create your own growth habit.', custom: true }
    ]
};

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
let selectedGoalCategory = GOAL_CATEGORIES[0].id;

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
    await loadLeaderboard();
}

function cleanupOnLogout() {
    // Reset all user data
    userId = null;
    useFirestore = false;
    challenges = [];
    workouts = [];
    selectedDays = [];
    userProfile = getDefaultProfile();
    leaderboardUsers = [];
    localStorage.removeItem(STORAGE_AUTH_USER_KEY);
    updateProfileCard();
    renderChallenges();
    renderWorkouts();
    renderLeaderboard();
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
        loadLeaderboard().catch(error => console.error('Error refreshing leaderboard:', error));
    } catch (error) {
        console.error('Error saving profile to Firestore:', error);
    }
}

async function loadChallengesFromFirestore() {
    if (!userId || !window.db) return;
    try {
        // Get challenges from user profile document
        if (userProfile && userProfile.challenges) {
            challenges = userProfile.challenges.map(normalizeChallenge);
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
        loadLeaderboard().catch(error => console.error('Error refreshing leaderboard:', error));
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
        loadLeaderboard().catch(error => console.error('Error refreshing leaderboard:', error));
    } catch (error) {
        console.error('Error saving workouts to Firestore:', error);
    }
}

function roundWaterAmount(value) {
    return Math.round(Number(value) * 100) / 100;
}

function sanitizeWaterQuickAmounts(amounts = []) {
    const unique = [...new Set(
        amounts
            .map(amount => roundWaterAmount(amount))
            .filter(amount => Number.isFinite(amount) && amount > 0)
    )];

    return unique.sort((a, b) => a - b);
}

function normalizeChallenge(challenge = {}) {
    const trackingMode = challenge.trackingMode === 'water' ? 'water' : 'standard';
    const waterHistory = challenge && typeof challenge.waterHistory === 'object' ? challenge.waterHistory : {};

    return {
        ...challenge,
        trackingMode,
        completedDates: challenge && typeof challenge.completedDates === 'object' ? challenge.completedDates : {},
        waterHistory,
        waterQuickAmounts: trackingMode === 'water'
            ? sanitizeWaterQuickAmounts(Array.isArray(challenge.waterQuickAmounts) ? challenge.waterQuickAmounts : [0.25, 0.5, 1])
            : [],
        dailyTargetLiters: trackingMode === 'water'
            ? roundWaterAmount(Number(challenge.dailyTargetLiters || 0)) || 0
            : 0
    };
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadChallenges();
    loadWorkouts();
    loadProfile();
    renderChallenges();
    renderWorkouts();
    updateProfileCard();
    renderGoalCategoryOptions();
    updateChallengeTrackingModeUI();
    renderSuggestionOptions('challenge');
    renderSuggestionOptions('workout');
    renderLeaderboard();

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
    challenges = stored ? JSON.parse(stored).map(normalizeChallenge) : [];
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
    if (type === 'challenge') {
        return GOAL_SUGGESTIONS[selectedGoalCategory] || [];
    }
    return WORKOUT_SUGGESTIONS;
}

const POINT_BADGE_IDS = [
    'first-points',
    'point-collector',
    'wealth',
    'point-overlord',
    'point-emperor',
    'point-celestial'
];

function getGoalCategoryLabel(categoryId) {
    const category = GOAL_CATEGORIES.find(option => option.id === categoryId);
    return category ? category.label : 'General';
}

function renderGoalCategoryOptions() {
    const container = document.getElementById('challengeCategoryOptions');
    if (!container) return;

    container.innerHTML = GOAL_CATEGORIES.map(category => `
        <button
            type="button"
            class="category-chip${category.id === selectedGoalCategory ? ' active' : ''}"
            onclick="selectGoalCategory('${category.id}')"
        >
            ${category.label}
        </button>
    `).join('');
}

function selectGoalCategory(categoryId) {
    selectedGoalCategory = categoryId;
    if (categoryId !== 'health' && selectedChallengeTrackingMode === 'water') {
        selectedChallengeTrackingMode = 'standard';
    }
    renderGoalCategoryOptions();
    updateChallengeTrackingModeUI();
    renderSuggestionOptions('challenge');
    clearSuggestionSelection('challenge');
    document.getElementById('challengeName').value = '';
    document.getElementById('challengeDetails').value = '';
}

function selectChallengeTrackingMode(mode) {
    selectedChallengeTrackingMode = mode === 'water' ? 'water' : 'standard';
    updateChallengeTrackingModeUI();

    if (selectedChallengeTrackingMode === 'water') {
        const nameInput = document.getElementById('challengeName');
        const detailsInput = document.getElementById('challengeDetails');
        if (!nameInput.value.trim()) {
            nameInput.value = 'Water Intake';
        }
        if (!detailsInput.value.trim()) {
            detailsInput.value = 'Track your daily water consumption glass by glass.';
        }
    }
}

function updateChallengeTrackingModeUI() {
    const trackingGroup = document.getElementById('challengeTrackingModeGroup');
    const waterFields = document.getElementById('waterChallengeFields');
    const isHealthCategory = selectedGoalCategory === 'health';
    const isWaterMode = isHealthCategory && selectedChallengeTrackingMode === 'water';

    if (trackingGroup) {
        trackingGroup.style.display = isHealthCategory ? 'block' : 'none';
    }

    if (waterFields) {
        waterFields.style.display = isWaterMode ? 'block' : 'none';
    }

    document.getElementById('challengeModeStandard')?.classList.toggle('active', !isWaterMode);
    document.getElementById('challengeModeWater')?.classList.toggle('active', isWaterMode);
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
        if (selectedGoalCategory === 'health') {
            selectedChallengeTrackingMode = suggestion.trackingMode === 'water' ? 'water' : 'standard';
            updateChallengeTrackingModeUI();
        }
        document.getElementById('challengeName').value = suggestion.custom ? '' : suggestion.name;
        document.getElementById('challengeDetails').value = suggestion.custom ? '' : suggestion.details;
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
    const isWaterChallenge = selectedGoalCategory === 'health' && selectedChallengeTrackingMode === 'water';

    if (!name.trim()) return;

    let dailyTargetLiters = 0;
    let waterQuickAmounts = [];

    if (isWaterChallenge) {
        dailyTargetLiters = roundWaterAmount(Number(document.getElementById('waterDailyTarget').value || 0));
        waterQuickAmounts = sanitizeWaterQuickAmounts(
            [
                ...Array.from(document.querySelectorAll('input[name="water-quick-size"]:checked')).map(input => input.value),
                document.getElementById('waterCustomQuickSize').value
            ]
        );

        if (waterQuickAmounts.length === 0) {
            waterQuickAmounts = [0.5, 1];
        }
    }

    if (editingChallengeId !== null) {
        const challengeIndex = challenges.findIndex(challenge => challenge.id === editingChallengeId);
        if (challengeIndex === -1) return;

        const existingChallenge = challenges[challengeIndex];
        const updatedChallenge = normalizeChallenge({
            ...existingChallenge,
            name,
            details,
            category: selectedGoalCategory,
            color,
            trackingMode: isWaterChallenge ? 'water' : 'standard',
            waterQuickAmounts,
            dailyTargetLiters,
            completedDates: isWaterChallenge ? existingChallenge.completedDates : (existingChallenge.completedDates || {}),
            waterHistory: isWaterChallenge ? (existingChallenge.waterHistory || {}) : {}
        });

        if (updatedChallenge.trackingMode === 'water') {
            refreshWaterCompletionState(updatedChallenge);
        }

        challenges[challengeIndex] = updatedChallenge;
        recordMilestone(
            'challenge-updated',
            `Updated goal "${name}"`,
            isWaterChallenge
                ? `Adjusted water settings to ${updatedChallenge.waterQuickAmounts.map(amount => formatWaterAmount(amount)).join(', ')} with a ${formatWaterAmount(updatedChallenge.dailyTargetLiters || 0)} target.`
                : `${getGoalCategoryLabel(selectedGoalCategory)} goal updated${details ? `: ${details}` : '.'}`
        );
    } else {
        const challenge = normalizeChallenge({
            id: Date.now(),
            name,
            details,
            category: selectedGoalCategory,
            color,
            createdDate: new Date().toISOString(),
            trackingMode: isWaterChallenge ? 'water' : 'standard',
            completedDates: {},
            waterHistory: {},
            waterQuickAmounts,
            dailyTargetLiters
        });

        challenges.push(challenge);
        recordMilestone(
            'challenge-created',
            `Created goal "${name}"`,
            isWaterChallenge
                ? `Health goal ready to log water with ${challenge.waterQuickAmounts.map(amount => `${formatWaterAmount(amount)}`).join(', ')} quick-add buttons.`
                : `${getGoalCategoryLabel(selectedGoalCategory)} goal${details ? `: ${details}` : ' is ready to track.'}`
        );
    }
    saveChallenges();
    renderChallenges();

    // Reset form and close modal
    editingChallengeId = null;
    selectedGoalCategory = GOAL_CATEGORIES[0].id;
    selectedChallengeTrackingMode = 'standard';
    document.getElementById('createChallengeForm').reset();
    document.querySelectorAll('input[name="water-quick-size"]').forEach(input => {
        input.checked = input.value === '0.25' || input.value === '0.5';
    });
    renderGoalCategoryOptions();
    updateChallengeTrackingModeUI();
    renderSuggestionOptions('challenge');
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

    if (editingWorkoutId !== null) {
        const workoutIndex = workouts.findIndex(workout => workout.id === editingWorkoutId);
        if (workoutIndex === -1) return;

        workouts[workoutIndex] = {
            ...workouts[workoutIndex],
            name,
            details,
            color,
            selectedDays: [...selectedDays]
        };

        recordMilestone(
            'workout-updated',
            `Updated workout "${name}"`,
            `Now scheduled on ${getWorkoutDayNames([...selectedDays]).join(', ')}`
        );
    } else {
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
    }
    saveWorkouts();
    renderWorkouts();

    // Reset form and close modal
    editingWorkoutId = null;
    selectedDays = [];
    document.getElementById('createWorkoutForm').reset();
    document.querySelectorAll('.day-btn').forEach(btn => btn.classList.remove('selected'));
    clearSuggestionSelection('workout');
    closeCreateModal('workout');
}

// Delete challenge
function deleteChallenge(id) {
    if (confirm('Delete this goal?')) {
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

function openEditChallengeModal(challengeId) {
    const challenge = challenges.find(item => item.id === challengeId);
    if (!challenge) return;

    editingChallengeId = challengeId;
    selectedGoalCategory = challenge.category || GOAL_CATEGORIES[0].id;
    selectedChallengeTrackingMode = challenge.trackingMode === 'water' ? 'water' : 'standard';

    document.getElementById('challengeName').value = challenge.name || '';
    document.getElementById('challengeDetails').value = challenge.details || '';
    document.getElementById('waterDailyTarget').value = challenge.dailyTargetLiters || 2;
    const builtInWaterSizes = new Set(['0.25', '0.5', '0.75', '1']);
    const customWaterAmount = (challenge.waterQuickAmounts || []).find(amount => !builtInWaterSizes.has(String(roundWaterAmount(amount))));
    document.getElementById('waterCustomQuickSize').value = customWaterAmount || '';

    document.querySelectorAll('input[name="color"]').forEach(input => {
        input.checked = input.value === challenge.color;
    });

    const quickAmounts = new Set((challenge.waterQuickAmounts || []).map(amount => String(roundWaterAmount(amount))));
    document.querySelectorAll('input[name="water-quick-size"]').forEach(input => {
        input.checked = quickAmounts.has(String(roundWaterAmount(input.value)));
    });

    renderGoalCategoryOptions();
    updateChallengeTrackingModeUI();
    renderSuggestionOptions('challenge');
    clearSuggestionSelection('challenge');
    document.querySelector('#createChallengeModal .modal-header h2').textContent = 'Edit Goal';
    document.getElementById('challengeSubmitButton').textContent = 'Save Goal';
    document.getElementById('createChallengeModal').classList.add('active');
}

function openEditWorkoutModal(workoutId) {
    const workout = workouts.find(item => item.id === workoutId);
    if (!workout) return;

    editingWorkoutId = workoutId;
    selectedDays = Array.isArray(workout.selectedDays) ? [...workout.selectedDays] : [];

    document.getElementById('workoutName').value = workout.name || '';
    document.getElementById('workoutDetails').value = workout.details || '';
    document.querySelectorAll('input[name="workout-color"]').forEach(input => {
        input.checked = input.value === workout.color;
    });

    updateDayPickerUI();
    renderSuggestionOptions('workout');
    clearSuggestionSelection('workout');
    document.querySelector('#createWorkoutModal .modal-header h2').textContent = 'Edit Workout';
    document.getElementById('workoutSubmitButton').textContent = 'Save Workout';
    document.getElementById('createWorkoutModal').classList.add('active');
}

function formatWaterAmount(amount) {
    const rounded = roundWaterAmount(amount);
    return `${rounded} L`;
}

function formatWaterAmountCompact(amount) {
    const rounded = roundWaterAmount(amount);
    return rounded >= 1 ? `${rounded}L` : `${Math.round(rounded * 1000)}ml`;
}

function getWaterEntryForDate(challenge, dateStr) {
    if (challenge.trackingMode !== 'water') {
        return { totalLiters: 0, entries: [] };
    }

    const entry = challenge.waterHistory?.[dateStr];
    return {
        totalLiters: roundWaterAmount(entry?.totalLiters || 0),
        entries: Array.isArray(entry?.entries) ? entry.entries : []
    };
}

function getWaterProgressDates(challenge) {
    if (challenge.trackingMode !== 'water') {
        return challenge.completedDates || {};
    }

    const target = Number(challenge.dailyTargetLiters || 0);
    const dates = {};
    Object.keys(challenge.waterHistory || {}).forEach(dateStr => {
        const total = Number(challenge.waterHistory[dateStr]?.totalLiters || 0);
        if ((target > 0 && total >= target) || (target <= 0 && total > 0)) {
            dates[dateStr] = true;
        }
    });
    return dates;
}

function refreshWaterCompletionState(challenge) {
    challenge.completedDates = getWaterProgressDates(challenge);
}

function addWaterEntry(challengeId, amountLiters) {
    const challenge = challenges.find(item => item.id === challengeId);
    if (!challenge || challenge.trackingMode !== 'water') return;

    const today = getDateString(new Date());
    const amount = roundWaterAmount(amountLiters);
    const currentEntry = getWaterEntryForDate(challenge, today);
    const previousTotal = currentEntry.totalLiters;
    const nextTotal = roundWaterAmount(previousTotal + amount);

    if (!challenge.waterHistory) {
        challenge.waterHistory = {};
    }

    challenge.waterHistory[today] = {
        totalLiters: nextTotal,
        entries: [
            ...currentEntry.entries,
            {
                amountLiters: amount,
                createdAt: new Date().toISOString()
            }
        ]
    };

    const target = Number(challenge.dailyTargetLiters || 0);
    const reachedBefore = target > 0 ? previousTotal >= target : previousTotal > 0;
    const reachedNow = target > 0 ? nextTotal >= target : nextTotal > 0;

    refreshWaterCompletionState(challenge);

    if (!reachedBefore && reachedNow) {
        const streak = getChallengeStreak(challenge);
        const points = calculatePoints('challenge', streak);
        addPoints(points);
        recordMilestone(
            'water-target-hit',
            `Logged water for "${challenge.name}"`,
            target > 0
                ? `Reached ${formatWaterAmount(target)} on ${today}.`
                : `Logged ${formatWaterAmount(nextTotal)} on ${today}.`
        );
    }

    saveChallenges();
    renderChallenges();
}

// Toggle day completion for challenge
function toggleChallengeDay(challengeId, dateStr) {
    const challenge = challenges.find(c => c.id === challengeId);
    if (challenge) {
        if (challenge.trackingMode === 'water') {
            return;
        }
        if (challenge.completedDates[dateStr]) {
            delete challenge.completedDates[dateStr];
        } else {
            challenge.completedDates[dateStr] = true;
            // Award points when marking as complete
            const streak = getChallengeStreak(challenge);
            const points = calculatePoints('challenge', streak);
            addPoints(points);
            recordMilestone('challenge-complete', `Completed goal "${challenge.name}"`, `${dateStr} completion saved with a ${streak}-day streak.`);
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
    const progressDates = getWaterProgressDates(challenge);

    while (true) {
        const dateStr = getDateString(currentDate);
        if (progressDates[dateStr]) {
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

function getEarliestCompletedDate(completedDates) {
    const completedKeys = Object.keys(completedDates || {}).sort();
    return completedKeys.length > 0 ? completedKeys[0] : null;
}

function getChallengeBestStreak(challenge) {
    const progressDates = getWaterProgressDates(challenge);
    const earliestDate = getEarliestCompletedDate(progressDates);
    if (!earliestDate) return 0;

    let bestStreak = 0;
    let currentStreak = 0;
    let currentDate = new Date(`${earliestDate}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    while (currentDate <= today) {
        const dateStr = getDateString(currentDate);
        if (progressDates[dateStr]) {
            currentStreak++;
            bestStreak = Math.max(bestStreak, currentStreak);
        } else {
            currentStreak = 0;
        }

        currentDate.setDate(currentDate.getDate() + 1);
    }

    return bestStreak;
}

function getWorkoutBestStreak(workout) {
    const earliestDate = getEarliestCompletedDate(workout.completedDates);
    if (!earliestDate || !Array.isArray(workout.selectedDays) || workout.selectedDays.length === 0) {
        return 0;
    }

    let bestStreak = 0;
    let currentStreak = 0;
    let currentDate = new Date(`${earliestDate}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    while (currentDate <= today) {
        const dayOfWeek = currentDate.getDay();
        if (workout.selectedDays.includes(dayOfWeek)) {
            const dateStr = getDateString(currentDate);
            if (workout.completedDates[dateStr]) {
                currentStreak++;
                bestStreak = Math.max(bestStreak, currentStreak);
            } else {
                currentStreak = 0;
            }
        }

        currentDate.setDate(currentDate.getDate() + 1);
    }

    return bestStreak;
}

function getStreakVisualTier(streak) {
    if (streak >= 1000) return { key: 'abyss', label: 'Abyssal fire' };
    if (streak >= 500) return { key: 'venom', label: 'Venom fire' };
    if (streak >= 100) return { key: 'frost', label: 'Frost fire' };
    if (streak >= 50) return { key: 'arcane', label: 'Arcane fire' };
    return { key: 'ember', label: 'Ember fire' };
}

function getStreakFireTiers() {
    return [
        { min: 10, key: 'ember', name: 'Ember Fire', description: 'Basic orange fire. Your streak is warming up.' },
        { min: 50, key: 'arcane', name: 'Arcane Fire', description: 'Purple energy starts taking over the flame.' },
        { min: 100, key: 'frost', name: 'Frost Fire', description: 'Blue fire for serious streak momentum.' },
        { min: 500, key: 'venom', name: 'Venom Fire', description: 'Green fire for a monster long streak.' },
        { min: 1000, key: 'abyss', name: 'Abyss Fire', description: 'Black evil fire for a brutal all-time streak.' }
    ];
}

function renderStreakFireButton(streak) {
    return `
        <button
            type="button"
            class="streak-fire-button"
            onclick="openStreakFireModal(${streak})"
            aria-label="Show streak fire styles for ${streak} streak"
        >
            ${renderStreakIcon(streak)}
        </button>
    `;
}

function renderStreakIcon(streak) {
    const tier = getStreakVisualTier(streak);
    streakIconIdCounter += 1;
    const filterId = `streakGlow-${tier.key}-${streakIconIdCounter}`;

    const palettes = {
        ember: { outer: '#ff9a3c', mid: '#ff6b2c', core: '#ffd166', glow: 'rgba(255, 140, 66, 0.35)' },
        arcane: { outer: '#c86bff', mid: '#8e44ad', core: '#f1c0ff', glow: 'rgba(155, 89, 182, 0.35)' },
        frost: { outer: '#64c8ff', mid: '#2d98da', core: '#dff6ff', glow: 'rgba(52, 152, 219, 0.35)' },
        venom: { outer: '#5df29d', mid: '#27ae60', core: '#d8ffe8', glow: 'rgba(46, 204, 113, 0.35)' },
        abyss: { outer: '#1a1a1a', mid: '#050505', core: '#ff3b30', glow: 'rgba(0, 0, 0, 0.55)' }
    };

    const palette = palettes[tier.key];
    const coreShape = tier.key === 'abyss'
        ? '<path d="M24 22 C19 18, 20 12, 24 8 C28 12, 29 18, 24 22 Z" fill="#ff3b30" opacity="0.95"/>'
        : `<path d="M25 25 C22 21, 22 17, 25 13 C28 17, 28 21, 25 25 Z" fill="${palette.core}" opacity="0.9"/>`;
    const evilMarks = tier.key === 'abyss'
        ? '<path d="M21 28 L19 24 L22 24 Z M27 28 L26 24 L29 24 Z" fill="#ff6b6b"/>'
        : '';

    return `
        <span class="streak-fire-icon streak-fire-${tier.key}" title="${tier.label}">
            <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
                <defs>
                    <filter id="${filterId}">
                        <feDropShadow dx="0" dy="0" stdDeviation="${tier.key === 'abyss' ? '3.5' : '2.5'}" flood-color="${palette.glow}"/>
                    </filter>
                </defs>
                <g filter="url(#${filterId})">
                    <path d="M24 4 C18 10, 14 15, 14 23 C14 33, 18 41, 24 44 C30 41, 34 33, 34 24 C34 16, 30 9, 24 4 Z" fill="${palette.outer}"/>
                    <path d="M24 9 C19 14, 18 18, 18 24 C18 31, 21 36, 24 39 C27 36, 30 31, 30 24 C30 18, 28 14, 24 9 Z" fill="${palette.mid}"/>
                    ${coreShape}
                    ${evilMarks}
                </g>
            </svg>
        </span>
    `;
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

    list.innerHTML = challenges.map(challenge => challenge.trackingMode === 'water'
        ? renderWaterChallengeCard(challenge)
        : `
            <div class="challenge-card" style="border-left-color: ${challenge.color}">
                <div class="challenge-header">
                    <div class="challenge-title">
                        <h3>${challenge.name}</h3>
                        <p class="goal-category-badge">${getGoalCategoryLabel(challenge.category)}</p>
                        <p class="challenge-details">${challenge.details}</p>
                    </div>
                    <div class="card-actions">
                        <button class="btn-edit" type="button" onclick="openEditChallengeModal(${challenge.id})">Edit</button>
                        <button class="btn-delete" data-id="${challenge.id}" onclick="deleteChallenge(${challenge.id})">🗑️</button>
                    </div>
                </div>

                <div class="streak-container">
                    ${renderStreakFireButton(getChallengeStreak(challenge))}
                    <span class="streak-count">${getChallengeStreak(challenge)}</span>
                    <span class="streak-label">day streak</span>
                </div>

                ${renderCalendar(challenge, 'challenge')}
            </div>
        `
    ).join('');
}

function renderWaterChallengeCard(challenge) {
    const today = getDateString(new Date());
    const todayEntry = getWaterEntryForDate(challenge, today);
    const dailyTarget = Number(challenge.dailyTargetLiters || 0);
    const progressPercent = dailyTarget > 0
        ? Math.min(100, Math.round((todayEntry.totalLiters / dailyTarget) * 100))
        : todayEntry.totalLiters > 0 ? 100 : 0;
    const historyRows = Object.entries(challenge.waterHistory || {})
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 7);

    return `
        <div class="challenge-card water-challenge-card" style="border-left-color: ${challenge.color}">
            <div class="challenge-header">
                <div class="challenge-title">
                    <h3>${challenge.name}</h3>
                    <p class="goal-category-badge">Health • Water</p>
                    <p class="challenge-details">${challenge.details}</p>
                </div>
                <button class="btn-delete" data-id="${challenge.id}" onclick="deleteChallenge(${challenge.id})">🗑️</button>
            </div>

            <div class="streak-container">
                ${renderStreakFireButton(getChallengeStreak(challenge))}
                <span class="streak-count">${getChallengeStreak(challenge)}</span>
                <span class="streak-label">${dailyTarget > 0 ? 'target streak' : 'active days'}</span>
            </div>

            <div class="water-quick-actions">
                <button
                    type="button"
                    class="btn-edit"
                    onclick="openEditChallengeModal(${challenge.id})"
                >
                    Edit Goal
                </button>
            </div>

            <div class="water-today-panel">
                <div>
                    <p class="water-panel-label">Today</p>
                    <p class="water-panel-total">${formatWaterAmount(todayEntry.totalLiters)}</p>
                    <p class="water-panel-subtitle">${dailyTarget > 0 ? `Target ${formatWaterAmount(dailyTarget)}` : 'No target set'}</p>
                </div>
                <div class="water-progress">
                    <div class="water-progress-bar">
                        <div class="water-progress-fill" style="width: ${progressPercent}%; background: ${challenge.color};"></div>
                    </div>
                    <span>${progressPercent}%</span>
                </div>
            </div>

            <div class="water-quick-actions">
                ${challenge.waterQuickAmounts.map(amount => `
                    <button
                        type="button"
                        class="water-add-btn"
                        onclick="addWaterEntry(${challenge.id}, ${amount})"
                    >
                        + ${formatWaterAmount(amount)}
                    </button>
                `).join('')}
            </div>

            <div class="water-history-panel">
                <div class="water-history-header">
                    <h4>Recent Water History</h4>
                    <span>${historyRows.length} day${historyRows.length === 1 ? '' : 's'}</span>
                </div>
                ${historyRows.length > 0 ? `
                    <div class="water-history-list">
                        ${historyRows.map(([dateStr, entry]) => `
                            <div class="water-history-item">
                                <div>
                                    <strong>${new Date(`${dateStr}T00:00:00`).toLocaleDateString()}</strong>
                                    <p>${Array.isArray(entry.entries) ? entry.entries.length : 0} drink${Array.isArray(entry.entries) && entry.entries.length === 1 ? '' : 's'}</p>
                                </div>
                                <span>${formatWaterAmount(Number(entry.totalLiters || 0))}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : '<p class="water-history-empty">No water logged yet. Use the quick buttons to start tracking.</p>'}
            </div>

            ${renderCalendar(challenge, 'challenge')}
        </div>
    `;
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
                ${renderStreakFireButton(getWorkoutStreak(workout))}
                <span class="streak-count">${getWorkoutStreak(workout)}</span>
                <span class="streak-label">streak</span>
            </div>

            <button class="start-workout-btn" onclick="startGhostMode(${workout.id})">👻 Start Workout</button>

            <div class="water-quick-actions">
                <button
                    type="button"
                    class="btn-edit"
                    onclick="openEditWorkoutModal(${workout.id})"
                >
                    Edit Workout
                </button>
            </div>

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
        const isWaterChallenge = type === 'challenge' && item.trackingMode === 'water';
        const waterEntry = isWaterChallenge ? getWaterEntryForDate(item, dateStr) : null;
        const progressDates = isWaterChallenge ? getWaterProgressDates(item) : item.completedDates;
        const isCompleted = progressDates[dateStr];
        const isToday = dateStr === today;
        const isOtherMonth = !isCurrentMonth;

        // For workouts, only show days that are selected for the workout
        let isSelectedDay = true;
        if (type === 'workout') {
            isSelectedDay = item.selectedDays.includes(dayOfWeek);
        }

        let className = 'calendar-day';
        if (isCompleted) className += ' completed';
        if (isWaterChallenge && waterEntry.totalLiters > 0) className += ' water-logged';
        if (isToday) className += ' today';
        if (isOtherMonth) className += ' other-month';
        if (type === 'workout' && !isSelectedDay) className += ' other-month'; // Gray out non-selected days

        const dayNum = date.getDate();
        const dataAttr = type === 'challenge' 
            ? `data-challenge-id="${item.id}" data-date="${dateStr}"`
            : `data-workout-id="${item.id}" data-date="${dateStr}"`;
        const onClickAttr = (isOtherMonth || (type === 'workout' && !isSelectedDay) || isWaterChallenge) ? '' : dataAttr;
        const dayContent = isWaterChallenge && waterEntry.totalLiters > 0
            ? `<div class="calendar-water-value">${formatWaterAmountCompact(waterEntry.totalLiters)}</div>`
            : (isCompleted ? '✓' : dayNum);

        calendarHTML += `
            <div class="${className}" ${onClickAttr}>
                ${dayContent}
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
        editingChallengeId = null;
        selectedGoalCategory = GOAL_CATEGORIES[0].id;
        selectedChallengeTrackingMode = 'standard';
        document.querySelector('#createChallengeModal .modal-header h2').textContent = 'New Goal';
        document.getElementById('challengeSubmitButton').textContent = 'Create Goal';
        renderGoalCategoryOptions();
        updateChallengeTrackingModeUI();
        renderSuggestionOptions('challenge');
        clearSuggestionSelection('challenge');
        document.getElementById('createChallengeModal').classList.add('active');
    } else if (type === 'workout') {
        editingWorkoutId = null;
        selectedDays = [];
        document.querySelector('#createWorkoutModal .modal-header h2').textContent = 'New Workout';
        document.getElementById('workoutSubmitButton').textContent = 'Create Workout';
        updateDayPickerUI();
        clearSuggestionSelection('workout');
        document.getElementById('createWorkoutModal').classList.add('active');
    }
}

function closeCreateModal(type) {
    if (type === 'challenge') {
        editingChallengeId = null;
        document.querySelector('#createChallengeModal .modal-header h2').textContent = 'New Goal';
        document.getElementById('challengeSubmitButton').textContent = 'Create Goal';
        document.getElementById('createChallengeModal').classList.remove('active');
    } else if (type === 'workout') {
        editingWorkoutId = null;
        document.querySelector('#createWorkoutModal .modal-header h2').textContent = 'New Workout';
        document.getElementById('workoutSubmitButton').textContent = 'Create Workout';
        document.getElementById('createWorkoutModal').classList.remove('active');
    }
}

// Setup modal close handlers
function setupModalHandlers() {
    // Close modals when clicking outside
    document.addEventListener('click', (e) => {
        const challengeModal = document.getElementById('createChallengeModal');
        const workoutModal = document.getElementById('createWorkoutModal');
        const profileModal = document.getElementById('profileModal');
        const streakFireModal = document.getElementById('streakFireModal');
        const leaderboardUserModal = document.getElementById('leaderboardUserModal');

        if (e.target === challengeModal) {
            closeCreateModal('challenge');
        }
        if (e.target === workoutModal) {
            closeCreateModal('workout');
        }
        if (e.target === profileModal) {
            closeProfileModal();
        }
        if (e.target === streakFireModal) {
            closeStreakFireModal();
        }
        if (e.target === leaderboardUserModal) {
            closeLeaderboardUserModal();
        }
    });

    // Close modals with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeCreateModal('challenge');
            closeCreateModal('workout');
            closeProfileModal();
            closeStreakFireModal();
            closeLeaderboardUserModal();
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
    } else if (tab === 'leaderboard') {
        document.getElementById('leaderboardTab').classList.add('active');
        document.querySelector('[onclick="switchTab(\'leaderboard\')"]').classList.add('active');
        loadLeaderboard().catch(error => console.error('Error loading leaderboard:', error));
    }
}

function getUserMaxChallengeStreak(userChallenges = []) {
    return userChallenges.length > 0
        ? Math.max(...userChallenges.map(challenge => getChallengeStreak(challenge)))
        : 0;
}

function getUserMaxWorkoutStreak(userWorkouts = []) {
    return userWorkouts.length > 0
        ? Math.max(...userWorkouts.map(workout => getWorkoutStreak(workout)))
        : 0;
}

function getLeaderboardEntryFromDoc(docSnap) {
    const data = docSnap.data();
    const docChallenges = Array.isArray(data.challenges)
        ? data.challenges.map(normalizeChallenge)
        : [];
    const docWorkouts = Array.isArray(data.workouts)
        ? data.workouts.map(workout => ({
            ...workout,
            completedDates: workout && typeof workout.completedDates === 'object' ? workout.completedDates : {},
            selectedDays: Array.isArray(workout?.selectedDays) ? workout.selectedDays : []
        }))
        : [];
    const badgeCount = Array.isArray(data.unlockedBadges) ? data.unlockedBadges.length : 0;
    const bestStreak = Math.max(
        getUserMaxChallengeStreak(docChallenges),
        getUserMaxWorkoutStreak(docWorkouts)
    );
    const points = Number(data.points || 0);

    return {
        id: docSnap.id,
        username: data.username || data.email?.split('@')[0] || 'Athlete',
        email: data.email || '',
        points,
        shields: Number(data.shields || 0),
        unlockedBadges: Array.isArray(data.unlockedBadges) ? data.unlockedBadges : [],
        badgeCount,
        challengeCount: docChallenges.length,
        workoutCount: docWorkouts.length,
        bestStreak,
        createdAt: data.createdAt || '',
        rankTitle: getAvatarStage(points).name
    };
}

async function loadLeaderboard() {
    const leaderboardList = document.getElementById('leaderboardList');
    if (leaderboardList) {
        leaderboardList.innerHTML = '<div class="empty-state"><p>Loading leaderboard...</p></div>';
    }

    if (!useFirestore || !window.db) {
        leaderboardUsers = [];
        renderLeaderboard();
        return;
    }

    try {
        const { collection, getDocs } = window.Firebase;
        const snapshot = await getDocs(collection(window.db, 'users'));
        leaderboardUsers = snapshot.docs
            .map(getLeaderboardEntryFromDoc)
            .sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
                return a.username.localeCompare(b.username);
            });
        renderLeaderboard();
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        if (leaderboardList) {
            leaderboardList.innerHTML = '<div class="empty-state"><p>Unable to load leaderboard right now.</p></div>';
        }
    }
}

function renderLeaderboard() {
    const leaderboardList = document.getElementById('leaderboardList');
    const emptyState = document.getElementById('leaderboardEmptyState');
    if (!leaderboardList || !emptyState) return;

    if (leaderboardUsers.length === 0) {
        leaderboardList.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    leaderboardList.innerHTML = leaderboardUsers.map((athlete, index) => `
        <button
            type="button"
            class="leaderboard-card ${athlete.id === userId ? 'current-user' : ''}"
            onclick="openLeaderboardUserModal('${athlete.id}')"
        >
            <div class="leaderboard-rank ${index < 3 ? 'top-three' : ''}">#${index + 1}</div>
            <div class="leaderboard-main">
                <div class="leaderboard-name-row">
                    <span class="leaderboard-name">${athlete.username}</span>
                    ${athlete.id === userId ? '<span class="leaderboard-you">You</span>' : ''}
                </div>
                <p class="leaderboard-rank-title">${athlete.rankTitle}</p>
                <div class="leaderboard-metrics">
                    <span class="leaderboard-metric">${athlete.badgeCount} badges</span>
                    <span class="leaderboard-metric">${athlete.challengeCount} challenges</span>
                    <span class="leaderboard-metric">${athlete.workoutCount} workouts</span>
                    <span class="leaderboard-metric">${athlete.bestStreak} best streak</span>
                </div>
            </div>
            <div class="leaderboard-score">
                <span class="leaderboard-score-value">${athlete.points}</span>
                <span class="leaderboard-score-label">Points</span>
            </div>
        </button>
    `).join('');
}

function openLeaderboardUserModal(userEntryId) {
    const athlete = leaderboardUsers.find(entry => entry.id === userEntryId);
    if (!athlete) return;

    const profileContainer = document.getElementById('leaderboardUserProfile');
    if (!profileContainer) return;

    const joinedText = athlete.createdAt
        ? new Date(athlete.createdAt).toLocaleDateString()
        : 'Unknown';
    const highestPointsBadge = getHighestUnlockedPointsBadge(athlete.unlockedBadges);

    profileContainer.innerHTML = `
        <div class="leaderboard-user-top">
            <div class="leaderboard-user-avatar">${getAvatarStage(athlete.points).icon}</div>
            <div class="leaderboard-user-copy">
                <h3>${athlete.username}</h3>
                <p>${athlete.rankTitle}</p>
                <p>Joined ${joinedText}</p>
            </div>
        </div>
        <div class="leaderboard-user-highlights">
            <div class="leaderboard-highlight-card">
                <div class="leaderboard-highlight-icon">
                    ${renderStreakIcon(athlete.bestStreak)}
                </div>
                <div class="leaderboard-highlight-copy">
                    <strong>Best Streak Fire</strong>
                    <span>${athlete.bestStreak} streak</span>
                </div>
            </div>
            <div class="leaderboard-highlight-card">
                <div class="leaderboard-highlight-badge ${highestPointsBadge ? 'earned' : 'empty'}">
                    ${highestPointsBadge ? highestPointsBadge.icon : '•'}
                </div>
                <div class="leaderboard-highlight-copy">
                    <strong>Top Points Badge</strong>
                    <span>${highestPointsBadge ? highestPointsBadge.name : 'No points badge earned yet'}</span>
                </div>
            </div>
        </div>
        <div class="leaderboard-user-grid">
            <div class="leaderboard-user-stat">
                <strong>${athlete.points}</strong>
                <span>Total points</span>
            </div>
            <div class="leaderboard-user-stat">
                <strong>${athlete.bestStreak}</strong>
                <span>Best streak</span>
            </div>
            <div class="leaderboard-user-stat">
                <strong>${athlete.badgeCount}</strong>
                <span>Badges earned</span>
            </div>
            <div class="leaderboard-user-stat">
                <strong>${athlete.shields}</strong>
                <span>Shields saved</span>
            </div>
            <div class="leaderboard-user-stat">
                <strong>${athlete.challengeCount}</strong>
                <span>Challenges tracked</span>
            </div>
            <div class="leaderboard-user-stat">
                <strong>${athlete.workoutCount}</strong>
                <span>Workouts tracked</span>
            </div>
        </div>
    `;

    document.getElementById('leaderboardUserModal').classList.add('active');
}

function closeLeaderboardUserModal() {
    document.getElementById('leaderboardUserModal').classList.remove('active');
}

function getHighestUnlockedPointsBadge(unlockedBadges = []) {
    const unlockedPointBadges = POINT_BADGE_IDS
        .map(id => ({ id, badge: BADGES[id] }))
        .filter(entry => entry.badge && unlockedBadges.includes(entry.id));

    return unlockedPointBadges.length > 0
        ? unlockedPointBadges[unlockedPointBadges.length - 1].badge
        : null;
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
    },
    'point-overlord': {
        name: 'Overlord Core',
        icon: '💠',
        description: 'Earn 2000 points',
        condition: (type, points) => points >= 2000 && type === 'points',
        rarity: 'epic'
    },
    'point-emperor': {
        name: 'Solar Crown',
        icon: '👑',
        description: 'Earn 5000 points',
        condition: (type, points) => points >= 5000 && type === 'points',
        rarity: 'legendary'
    },
    'point-celestial': {
        name: 'Void Monarch',
        icon: '🌌',
        description: 'Earn 10000 points',
        condition: (type, points) => points >= 10000 && type === 'points',
        rarity: 'mythic'
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
    renderProfileStreaks();
    renderBadgesDisplay();
    renderMilestones();
    
    document.getElementById('profileModal').classList.add('active');
}

// Close profile modal
function closeProfileModal() {
    document.getElementById('profileModal').classList.remove('active');
}

function openStreakFireModal(streak) {
    activeStreakFireValue = streak;
    const tiers = getStreakFireTiers();
    const unlockedCount = tiers.filter(tier => streak >= tier.min).length;

    document.getElementById('streakFireModalSummary').textContent =
        unlockedCount > 0
            ? `${streak} streak unlocked ${unlockedCount} fire style${unlockedCount === 1 ? '' : 's'}.`
            : `${streak} streak has not unlocked a named fire style yet. Reach 10 to unlock Ember Fire.`;

    document.getElementById('streakFireTiers').innerHTML = tiers.map(tier => {
        const unlocked = streak >= tier.min;
        return `
            <div class="streak-fire-tier ${unlocked ? 'unlocked' : 'locked'}">
                <div class="streak-fire-tier-copy">
                    <div class="streak-fire-tier-topline">
                        <strong>${tier.name}</strong>
                        <span>${tier.min}+ streak needed</span>
                    </div>
                </div>
                <span class="streak-fire-tier-state">${unlocked ? 'Unlocked' : 'Locked'}</span>
            </div>
        `;
    }).join('');

    document.getElementById('streakFireModal').classList.add('active');
}

function closeStreakFireModal() {
    activeStreakFireValue = 0;
    document.getElementById('streakFireModal').classList.remove('active');
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

function renderProfileStreaks() {
    const streaksContainer = document.getElementById('profileStreaksDisplay');
    if (!streaksContainer) return;

    const challengeRows = challenges.map(challenge => ({
        name: challenge.name,
        label: 'Goal',
        current: getChallengeStreak(challenge),
        highest: getChallengeBestStreak(challenge)
    }));

    const workoutRows = workouts.map(workout => ({
        name: workout.name,
        label: 'Workout',
        current: getWorkoutStreak(workout),
        highest: getWorkoutBestStreak(workout)
    }));

    if (challengeRows.length === 0 && workoutRows.length === 0) {
        streaksContainer.innerHTML = '<p class="profile-streak-empty">Your challenge and workout streaks will appear here once you start tracking them.</p>';
        return;
    }

    streaksContainer.innerHTML = `
        ${renderProfileStreakGroup('Goals', challengeRows)}
        ${renderProfileStreakGroup('Workouts', workoutRows)}
    `;
}

function renderProfileStreakGroup(title, items) {
    if (items.length === 0) {
        return `
            <div class="profile-streak-group">
                <h5>${title}</h5>
                <p class="profile-streak-empty">No ${title.toLowerCase()} yet.</p>
            </div>
        `;
    }

    return `
        <div class="profile-streak-group">
            <h5>${title}</h5>
            <div class="profile-streak-list">
                ${items.map(item => `
                    <div class="profile-streak-item">
                        <div class="profile-streak-item-main">
                            <p class="profile-streak-item-name">${item.name}</p>
                            <p class="profile-streak-item-type">${item.label}</p>
                        </div>
                        <div class="profile-streak-stats">
                            <div class="profile-streak-stat">
                                ${renderStreakFireButton(item.current)}
                                <span class="profile-streak-stat-value">${item.current}</span>
                                <span class="profile-streak-stat-label">Current</span>
                            </div>
                            <div class="profile-streak-stat">
                                ${renderStreakFireButton(item.highest)}
                                <span class="profile-streak-stat-value">${item.highest}</span>
                                <span class="profile-streak-stat-label">Highest</span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
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
    POINT_BADGE_IDS.forEach(id => {
        const badge = BADGES[id];
        if (!badge || userProfile.unlockedBadges.includes(id)) return;
        if (badge.condition('points', userProfile.points)) {
            userProfile.unlockedBadges.push(id);
            recordMilestone('badge', `Unlocked badge "${badge.name}"`, badge.description, false);
            showBadgeUnlock(id, badge);
        }
    });
    
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
