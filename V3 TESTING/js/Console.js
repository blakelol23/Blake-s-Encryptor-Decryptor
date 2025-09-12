// BLAKE THIS COMMENT EXISTS BECAUSE I KEEP FORGETTING WHAT THE FUCKING KEYBIND IS TO OPEN THIS CONSOLE.
// IT'S ALT + C

(function() {
    const privateScope = {};
    const messageBuffer = [];
    const MAX_BUFFER_SIZE = 100;
    const existingConsole = document.getElementById('customConsole');
    if (existingConsole) existingConsole.remove();
    const consoleDiv = document.createElement('div');
    consoleDiv.id = 'customConsole';
    document.body.appendChild(consoleDiv);
    const headerDiv = document.createElement('div');
    headerDiv.id = 'consoleHeader';
    consoleDiv.appendChild(headerDiv);
    const contentDiv = document.createElement('div');
    contentDiv.id = 'consoleContent';
    consoleDiv.appendChild(contentDiv);
    const configMenu = document.createElement('div');
    configMenu.id = 'configMenu';
    configMenu.style.display = 'none';
    consoleDiv.appendChild(configMenu);
    const title = document.createElement('div');
    title.id = 'consoleTitle';
    title.textContent = 'CONSOLE';
    headerDiv.appendChild(title);
    const configButton = document.createElement('div');
    configButton.id = 'consoleConfig';
    configButton.textContent = 'CONFIGURE';
    headerDiv.appendChild(configButton);
    const closeButton = document.createElement('span');
    closeButton.textContent = 'x';
    closeButton.id = 'consoleClose';
    headerDiv.appendChild(closeButton);
    const inputArea = document.createElement('div');
    inputArea.id = 'consoleInputArea';
    consoleDiv.appendChild(inputArea);
    const input = document.createElement('input');
    input.id = 'consoleInput';
    input.type = 'text';
    input.placeholder = '...';
    inputArea.appendChild(input);
    const suggestionContainer = document.createElement('div');
    suggestionContainer.id = 'consoleSuggestionContainer';
    suggestionContainer.style.position = 'absolute';
    suggestionContainer.style.left = '10px';
    suggestionContainer.style.bottom = '35px';
    suggestionContainer.style.background = '#2a2a2a';
    suggestionContainer.style.border = '1px solid #444';
    suggestionContainer.style.maxHeight = '150px';
    suggestionContainer.style.overflowY = 'auto';
    suggestionContainer.style.display = 'none';
    suggestionContainer.style.zIndex = '1003';
    inputArea.appendChild(suggestionContainer);

    // Loading Screen
    const loadingScreen = document.createElement('div');
    loadingScreen.id = 'consoleLoadingScreen';
    loadingScreen.style.position = 'fixed';
    loadingScreen.style.top = '50%';
    loadingScreen.style.left = '50%';
    loadingScreen.style.transform = 'translate(-50%, -50%)';
    loadingScreen.style.background = 'rgba(26, 26, 26, 0.9)';
    loadingScreen.style.padding = '20px';
    loadingScreen.style.borderRadius = '8px';
    loadingScreen.style.color = '#fff';
    loadingScreen.style.fontFamily = 'monospace';
    loadingScreen.style.zIndex = '1001';
    loadingScreen.style.display = 'none';
    loadingScreen.innerHTML = `
        <div id="loadingSpinner" style="border: 4px solid #f3f3f3; border-top: 4px solid #00ffff; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 0 auto 10px;"></div>
        <div>Initializing Console...</div>
        <div id="loadingTips" style="font-size: 12px; opacity: 0.7; margin-top: 10px;">Tip: Press Alt+C to toggle the console!</div>
    `;
    document.body.appendChild(loadingScreen);

    const colorToggleLabel = document.createElement('label');
    colorToggleLabel.textContent = 'Enable Console Colors: ';
    colorToggleLabel.style.margin = '10px';
    colorToggleLabel.htmlFor = 'colorToggle';
    configMenu.appendChild(colorToggleLabel);
    const colorToggleContainer = document.createElement('div');
    colorToggleContainer.className = 'slider-container';
    configMenu.appendChild(colorToggleContainer);
    const colorToggle = document.createElement('input');
    colorToggle.type = 'checkbox';
    colorToggle.id = 'colorToggle';
    colorToggle.style.display = 'none';
    colorToggleContainer.appendChild(colorToggle);
    const colorSlider = document.createElement('span');
    colorSlider.className = 'slider';
    colorToggleContainer.appendChild(colorSlider);
    configMenu.appendChild(document.createElement('br'));
    const suggestionsToggleLabel = document.createElement('label');
    suggestionsToggleLabel.textContent = 'Enable Suggestions: ';
    suggestionsToggleLabel.style.margin = '10px';
    suggestionsToggleLabel.htmlFor = 'suggestionsToggle';
    configMenu.appendChild(suggestionsToggleLabel);
    const suggestionsToggleContainer = document.createElement('div');
    suggestionsToggleContainer.className = 'slider-container';
    configMenu.appendChild(suggestionsToggleContainer);
    const suggestionsToggle = document.createElement('input');
    suggestionsToggle.type = 'checkbox';
    suggestionsToggle.id = 'suggestionsToggle';
    suggestionsToggle.style.display = 'none';
    suggestionsToggleContainer.appendChild(suggestionsToggle);
    const suggestionsSlider = document.createElement('span');
    suggestionsSlider.className = 'slider';
    suggestionsToggleContainer.appendChild(suggestionsSlider);
    configMenu.appendChild(document.createElement('br'));
    const themeToggleLabel = document.createElement('label');
    themeToggleLabel.textContent = 'Dark Mode: ';
    themeToggleLabel.style.margin = '10px';
    themeToggleLabel.htmlFor = 'themeToggle';
    configMenu.appendChild(themeToggleLabel);
    const themeToggleContainer = document.createElement('div');
    themeToggleContainer.className = 'slider-container';
    configMenu.appendChild(themeToggleContainer);
    const themeToggle = document.createElement('input');
    themeToggle.type = 'checkbox';
    themeToggle.id = 'themeToggle';
    themeToggle.style.display = 'none';
    themeToggleContainer.appendChild(themeToggle);
    const themeSlider = document.createElement('span');
    themeSlider.className = 'slider';
    themeToggleContainer.appendChild(themeSlider);
    configMenu.appendChild(document.createElement('br'));
    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset to Defaults';
    resetButton.style.margin = '10px';
    resetButton.style.padding = '5px 10px';
    resetButton.style.background = '#ff4444';
    resetButton.style.color = '#fff';
    resetButton.style.border = 'none';
    resetButton.style.cursor = 'pointer';
    configMenu.appendChild(resetButton);

    let isColorEnabled = true;
    let isSuggestionsEnabled = true;
    let isDarkMode = true;
    let currentX = 50;
    let currentY = 50;
    const MAX_LOGS = 1000;
    let isDragging = false;
    let initialX;
    let initialY;
    let availableFunctions = [];
    let selectedIndex = -1;
    let hasShownLargeTitle = false;

    const style = document.createElement('style');
    style.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700&family=Roboto+Condensed:wght@700&display=swap');
        #customConsole {
            position: fixed;
            top: 50px;
            left: 50px;
            width: 800px;
            height: 400px;
            max-height: 50vh;
            background: #1a1a1a;
            color: #fff;
            font-family: monospace;
            box-sizing: border-box;
            display: none;
            z-index: 1000;
            border: 2px solid #333;
            cursor: move;
            user-select: none;
            opacity: 0;
            transition: opacity 0.2s ease-in-out;
        }
        #customConsole.visible {
            display: block;
            opacity: 1;
        }
        #customConsole.light-mode {
            background: #f0f0f0;
            color: #000;
            border: 2px solid #ccc;
        }
        #customConsole.light-mode #consoleHeader {
            background: #e0e0e0;
        }
        #customConsole.light-mode #consoleInputArea {
            background: #e0e0e0;
            border-top: 1px solid #ccc;
        }
        #customConsole.light-mode #consoleInput {
            background: #fff;
            color: #000;
            border: 1px solid #999;
        }
        #customConsole.light-mode #consoleSuggestionContainer {
            background: #fff;
            border: 1px solid #999;
            color: #333;
        }
        #consoleHeader {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 30px;
            background: #1a1a1a;
            padding: 5px 10px;
            z-index: 1001;
        }
        #consoleContent, #configMenu {
            margin-top: 40px;
            margin-bottom: 35px;
            padding: 0 10px;
            overflow-y: auto;
            height: calc(100% - 80px);
            box-sizing: border-box;
            scrollbar-width: thin;
            scrollbar-color: #00ffff #2a2a2a;
        }
        #customConsole.light-mode #consoleContent::-webkit-scrollbar-track,
        #customConsole.light-mode #configMenu::-webkit-scrollbar-track {
            background: #e0e0e0;
            border-left: 1px solid #ccc;
        }
        #customConsole.light-mode #consoleContent::-webkit-scrollbar-thumb,
        #customConsole.light-mode #configMenu::-webkit-scrollbar-thumb {
            background: linear-gradient(45deg, #00b7b7, #00ffff);
            border: 1px solid #e0e0e0;
        }
        #consoleContent::-webkit-scrollbar, #configMenu::-webkit-scrollbar {
            width: 10px;
        }
        #consoleContent::-webkit-scrollbar-track, #configMenu::-webkit-scrollbar-track {
            background: #2a2a2a;
            border-left: 1px solid #333;
        }
        #consoleContent::-webkit-scrollbar-thumb, #configMenu::-webkit-scrollbar-thumb {
            background: linear-gradient(45deg, #00ffff, #00b7b7);
            border-radius: 5px;
            border: 1px solid #1a1a1a;
            box-shadow: inset 0 0 5px rgba(0, 255, 255, 0.3);
        }
        #consoleTitle {
            position: absolute;
            top: 5px;
            left: 10px;
            font-family: 'Orbitron', monospace;
            font-size: 18px;
            font-weight: 700;
            color: #fff;
            background: linear-gradient(90deg, #a6a6a6, #636262);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
            text-shadow: 0 0 5px rgba(99, 98, 98, 0.8);
            padding: 2px 8px;
            border-radius: 4px;
        }
        #consoleConfig {
            position: absolute;
            top: 10px;
            left: 140px;
            font-family: 'Roboto Condensed', monospace;
            font-size: 10px;
            font-weight: 700;
            color: #fff;
            background: linear-gradient(90deg, #ffffff, #d3d3d3);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
            text-shadow: 0 0 5px rgba(255, 255, 255, 0.8);
            padding: 1px 4px;
            border-radius: 2px;
            cursor: pointer;
        }
        #customConsole.light-mode #consoleConfig {
            background: none;
            color: #000;
            text-shadow: none;
        }
        #consoleClose {
            position: absolute;
            top: 5px;
            right: 7px;
            color: #ff4444;
            font-size: 20px;
            cursor: pointer;
            line-height: 1;
        }
        #customConsole .console-line {
            margin: 3px 0;
            word-wrap: break-word;
            opacity: 0;
            animation: fadeIn 0.3s ease forwards;
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        #customConsole .log { color: #ffffff; }
        #customConsole .warn { color: #ffff00; }
        #customConsole .error { color: #ff4444; }
        #customConsole .info { color: #00ffff; }
        #customConsole .input-test { color: #74ed7a; }
        #customConsole .input-default { color: #ffffff; }
        #customConsole.light-mode .log { color: #000000; }
        #customConsole.light-mode .warn { color: #cc9900; }
        #customConsole.light-mode .error { color: #cc0000; }
        #customConsole.light-mode .info { color: #0066cc; }
        #customConsole.light-mode .input-test { color: #006600; }
        #customConsole.light-mode .input-default { color: #000000; }
        #customConsole.no-colors .log,
        #customConsole.no-colors .warn,
        #customConsole.no-colors .error,
        #customConsole.no-colors .input-test,
        #customConsole.no-colors .input-default {
            color: inherit;
        }
        #consoleInputArea {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            padding: 5px 10px;
            background: #2a2a2a;
            border-top: 1px solid #333;
            z-index: 1001;
        }
        #consoleInput {
            width: 100%;
            background: #1a1a1a;
            border: 1px solid #444;
            color: #fff;
            font-family: monospace;
            padding: 5px;
            box-sizing: border-box;
            outline: none;
            z-index: 1002;
        }
        #consoleSuggestionContainer {
            color: #888;
            font-family: monospace;
            padding: 5px;
            width: 200px;
            scrollbar-width: thin;
            scrollbar-color: #00ffff #2a2a2a;
        }
        #consoleSuggestionContainer div {
            padding: 2px 5px;
            cursor: pointer;
        }
        #consoleSuggestionContainer div:hover {
            background: #3a3a2a;
            color: #fff;
        }
        #consoleSuggestionContainer div.selected {
            background: #00ffff;
            color: #000;
        }
        #configMenu {
            color: #fff;
            font-family: monospace;
            padding: 10px;
        }
        #customConsole.light-mode #configMenu {
            color: #000;
        }
        #customConsole.light-mode #configMenu label {
            color: #000;
        }
        #customConsole.light-mode #configMenu button {
            color: #fff;
        }
        #configMenu label {
            display: inline-block;
            vertical-align: middle;
            margin-right: 10px;
        }
        .slider-container {
            position: relative;
            display: inline-block;
            width: 40px;
            height: 20px;
            vertical-align: middle;
        }
        .slider {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #444;
            border-radius: 20px;
            cursor: pointer;
            transition: background-color 0.4s;
        }
        .slider:before {
            position: absolute;
            content: "";
            height: 16px;
            width: 16px;
            left: 2px;
            bottom: 2px;
            background-color: #fff;
            border-radius: 50%;
            transition: transform 0.4s;
        }
        #colorToggle:checked + .slider,
        #suggestionsToggle:checked + .slider,
        #themeToggle:checked + .slider {
            background-color: #00ffff;
        }
        #colorToggle:checked + .slider:before,
        #suggestionsToggle:checked + .slider:before,
        #themeToggle:checked + .slider:before {
            transform: translateX(20px);
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);

    const originalConsole = {
        log: console.log,
        warn: console.warn,
        error: console.error,
        info: console.info
    };

    privateScope.addToConsole = function(type, args, extraClass = '') {
        const line = document.createElement('div');
        line.className = `console-line ${type} ${extraClass}`.trim();
        const message = Array.from(args).map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg) : arg
        ).join(' ');
        line.textContent = `[${type.toUpperCase()}] ${message}`;
        contentDiv.appendChild(line);
        while (contentDiv.children.length > MAX_LOGS) {
            contentDiv.removeChild(contentDiv.firstChild);
        }
        contentDiv.scrollTop = contentDiv.scrollHeight;
    };

    console.log = (...args) => {
        if (consoleDiv.classList.contains('visible')) {
            privateScope.addToConsole('log', args);
        } else {
            if (messageBuffer.length >= MAX_BUFFER_SIZE) {
                messageBuffer.shift();
            }
            messageBuffer.push({ type: 'log', args });
        }
        originalConsole.log.apply(console, args);
    };

    console.warn = (...args) => {
        if (consoleDiv.classList.contains('visible')) {
            privateScope.addToConsole('warn', args);
        } else {
            if (messageBuffer.length >= MAX_BUFFER_SIZE) {
                messageBuffer.shift();
            }
            messageBuffer.push({ type: 'warn', args });
        }
        originalConsole.warn.apply(console, args);
    };

    console.error = (...args) => {
        if (consoleDiv.classList.contains('visible')) {
            privateScope.addToConsole('error', args);
        } else {
            if (messageBuffer.length >= MAX_BUFFER_SIZE) {
                messageBuffer.shift();
            }
            messageBuffer.push({ type: 'error', args });
        }
        originalConsole.error.apply(console, args);
    };

    console.info = (...args) => {
        if (consoleDiv.classList.contains('visible')) {
            privateScope.addToConsole('info', args);
        } else {
            if (messageBuffer.length >= MAX_BUFFER_SIZE) {
                messageBuffer.shift();
            }
            messageBuffer.push({ type: 'info', args });
        }
        originalConsole.info.apply(console, args);
    };

    privateScope.flushBuffer = function() {
        while (messageBuffer.length > 0) {
            const message = messageBuffer.shift();
            privateScope.addToConsole(message.type, message.args);
        }
    };

    privateScope.loadSettings = function() {
        const savedColors = localStorage.getItem('consoleColorsEnabled');
        const savedSuggestions = localStorage.getItem('consoleSuggestionsEnabled');
        const savedTheme = localStorage.getItem('consoleTheme');
        const savedX = localStorage.getItem('consoleX');
        const savedY = localStorage.getItem('consoleY');
        isColorEnabled = savedColors !== null ? JSON.parse(savedColors) : true;
        isSuggestionsEnabled = savedSuggestions !== null ? JSON.parse(savedSuggestions) : true;
        isDarkMode = savedTheme !== null ? JSON.parse(savedTheme) : true;
        currentX = savedX !== null ? parseInt(savedX) : 50;
        currentY = savedY !== null ? parseInt(savedY) : 50;
        colorToggle.checked = isColorEnabled;
        suggestionsToggle.checked = isSuggestionsEnabled;
        themeToggle.checked = isDarkMode;
        consoleDiv.style.left = `${currentX}px`;
        consoleDiv.style.top = `${currentY}px`;
        consoleDiv.classList.toggle('no-colors', !isColorEnabled);
        consoleDiv.classList.toggle('light-mode', !isDarkMode);
    };

    privateScope.saveSettings = function() {
        localStorage.setItem('consoleColorsEnabled', JSON.stringify(isColorEnabled));
        localStorage.setItem('consoleSuggestionsEnabled', JSON.stringify(isSuggestionsEnabled));
        localStorage.setItem('consoleTheme', JSON.stringify(isDarkMode));
        localStorage.setItem('consoleX', currentX);
        localStorage.setItem('consoleY', currentY);
    };

    privateScope.resetSettings = function() {
        localStorage.clear();
        isColorEnabled = true;
        isSuggestionsEnabled = true;
        isDarkMode = true;
        currentX = 50;
        currentY = 50;
        colorToggle.checked = true;
        suggestionsToggle.checked = true;
        themeToggle.checked = true;
        consoleDiv.style.left = '50px';
        consoleDiv.style.top = '50px';
        consoleDiv.classList.remove('no-colors');
        consoleDiv.classList.remove('light-mode');
        contentDiv.innerHTML = '';
    };

    privateScope.clearLocalStorage = function() {
        localStorage.clear();
        privateScope.addToConsole('info', ['LocalStorage cleared']);
        privateScope.resetSettings(); // Optionally reset settings to defaults after clearing
    };

    privateScope.showSettings = function() {
        privateScope.addToConsole('info', ['Current Settings:']);
        privateScope.addToConsole('info', [`Colors Enabled: ${isColorEnabled}`]);
        privateScope.addToConsole('info', [`Suggestions Enabled: ${isSuggestionsEnabled}`]);
        privateScope.addToConsole('info', [`Dark Mode: ${isDarkMode}`]);
        privateScope.addToConsole('info', [`Position X: ${currentX}, Y: ${currentY}`]);
    };

    const internalFunctions = Object.keys(privateScope).concat([
        'console', 'alert', 'prompt', 'confirm',
        'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'
    ]);

    privateScope.updateAvailableFunctions = function() {
        availableFunctions = [
            'sayHello',
            'showTime',
            'randomNumber',
            'warningMessage',
            'clearLocalStorage',
            'saveSettings',
            'loadSettings',
            'showSettings'
        ].filter(key => typeof window[key] === 'function' || typeof privateScope[key] === 'function').sort();
    };

    privateScope.getSuggestions = function(inputValue) {
        if (!availableFunctions.length) return [];
        const trimmedInput = inputValue.trim().toLowerCase();
        if (!trimmedInput) return [];
        return availableFunctions
            .filter(fn => fn.toLowerCase().startsWith(trimmedInput))
            .slice(0, 5);
    };

    privateScope.showAvailableFunctions = function() {
        if (availableFunctions.length === 0) {
            privateScope.addToConsole('info', ['No external functions available']);
        } else {
            const functionList = availableFunctions.map(fn => `${fn}()`).join(', ');
            privateScope.addToConsole('info', ['Available functions: ' + functionList]);
        }
    };

    privateScope.updateSelection = function() {
        const suggestionDivs = suggestionContainer.children;
        for (let i = 0; i < suggestionDivs.length; i++) {
            suggestionDivs[i].classList.toggle('selected', i === selectedIndex);
        }
        if (selectedIndex >= 0) {
            suggestionDivs[selectedIndex].scrollIntoView({ block: 'nearest' });
        }
    };

    privateScope.renderSuggestions = function(suggestions) {
        suggestionContainer.innerHTML = '';
        const itemHeight = 25;
        const visibleHeight = suggestionContainer.offsetHeight;
        const maxVisibleItems = Math.ceil(visibleHeight / itemHeight);
        const startIndex = Math.max(0, selectedIndex - Math.floor(maxVisibleItems / 2));
        const endIndex = Math.min(suggestions.length, startIndex + maxVisibleItems);
        for (let i = startIndex; i < endIndex; i++) {
            const suggestion = suggestions[i];
            const suggestionDiv = document.createElement('div');
            suggestionDiv.textContent = suggestion + '()';
            suggestionDiv.dataset.value = suggestion;
            suggestionDiv.dataset.index = i;
            suggestionContainer.appendChild(suggestionDiv);
            suggestionDiv.addEventListener('click', function() {
                input.value = this.dataset.value + '()';
                suggestionContainer.style.display = 'none';
                input.focus();
            });
        }
        privateScope.updateSelection();
    };

    consoleDiv.addEventListener('mousedown', (e) => {
        if (e.target === closeButton || e.target === title || e.target === configButton) return;
        isDragging = true;
        initialX = e.clientX - currentX;
        initialY = e.clientY - currentY;
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            consoleDiv.style.left = `${currentX}px`;
            consoleDiv.style.top = `${currentY}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            privateScope.saveSettings();
        }
        isDragging = false;
    });

    closeButton.addEventListener('click', () => {
        consoleDiv.classList.remove('visible');
        contentDiv.style.display = 'block';
        configMenu.style.display = 'none';
    });

    configButton.addEventListener('click', () => {
        if (configMenu.style.display === 'none') {
            contentDiv.style.display = 'none';
            configMenu.style.display = 'block';
        } else {
            contentDiv.style.display = 'block';
            configMenu.style.display = 'none';
        }
    });

    colorSlider.addEventListener('click', () => {
        colorToggle.checked = !colorToggle.checked;
        isColorEnabled = colorToggle.checked;
        consoleDiv.classList.toggle('no-colors', !isColorEnabled);
        privateScope.saveSettings();
    });

    colorToggle.addEventListener('change', () => {
        isColorEnabled = colorToggle.checked;
        consoleDiv.classList.toggle('no-colors', !isColorEnabled);
        privateScope.saveSettings();
    });

    suggestionsSlider.addEventListener('click', () => {
        suggestionsToggle.checked = !suggestionsToggle.checked;
        isSuggestionsEnabled = suggestionsToggle.checked;
        privateScope.saveSettings();
    });

    suggestionsToggle.addEventListener('change', () => {
        isSuggestionsEnabled = suggestionsToggle.checked;
        privateScope.saveSettings();
    });

    themeSlider.addEventListener('click', () => {
        themeToggle.checked = !themeToggle.checked;
        isDarkMode = themeToggle.checked;
        consoleDiv.classList.toggle('light-mode', !isDarkMode);
        privateScope.saveSettings();
    });

    themeToggle.addEventListener('change', () => {
        isDarkMode = themeToggle.checked;
        consoleDiv.classList.toggle('light-mode', !isDarkMode);
        privateScope.saveSettings();
    });

    resetButton.addEventListener('click', () => {
        privateScope.resetSettings();
    });

    input.addEventListener('input', function() {
        if (!isSuggestionsEnabled) {
            suggestionContainer.style.display = 'none';
            return;
        }
        const suggestions = privateScope.getSuggestions(input.value);
        selectedIndex = -1;
        if (suggestions.length > 0) { 
            privateScope.renderSuggestions(suggestions);
            suggestionContainer.style.display = 'block';
        } else {
            suggestionContainer.style.display = 'none';
        }
    });

    input.addEventListener('keydown', function(e) {
        if (!isSuggestionsEnabled) return;
        const suggestions = privateScope.getSuggestions(input.value);
        if (e.key === 'Tab' && suggestions.length > 0) {
            e.preventDefault();
            selectedIndex = (selectedIndex + 1) % suggestions.length;
            privateScope.renderSuggestions(suggestions);
        } else if (e.key === 'ArrowDown' && suggestions.length > 0) {
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, suggestions.length - 1);
            privateScope.renderSuggestions(suggestions);
        } else if (e.key === 'ArrowUp' && suggestions.length > 0) {
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, 0);
            privateScope.renderSuggestions(suggestions);
        } else if (e.key === 'Enter' && suggestions.length > 0 && selectedIndex >= 0) {
            e.preventDefault();
            input.value = suggestions[selectedIndex] + '()';
            suggestionContainer.style.display = 'none';
            selectedIndex = -1;
        } else if (e.key === 'Escape') {
            suggestionContainer.style.display = 'none';
            selectedIndex = -1;
        }
    });

    document.addEventListener('click', function(e) {
        if (!inputArea.contains(e.target)) {
            suggestionContainer.style.display = 'none';
            selectedIndex = -1;
        }
    });

    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && input.value.trim() !== '') {
            const inputValue = input.value.trim();
            const testVariations = /^(test|test\(\))$/i;
            const functionCallMatch = /^([a-zA-Z_]\w*)\s*\(\)$/i;
            const showFunctionsMatch = /^!(functions|show functions|show)$/i;
            const allowedCommands = /^(clear|clear\(\)|test|test\(\)|!functions|!show functions|!show|clearLocalStorage|clearLocalStorage\(\)|saveSettings|saveSettings\(\)|loadSettings|loadSettings\(\)|showSettings|showSettings\(\))$/i;
            suggestionContainer.style.display = 'none';
            selectedIndex = -1;

            if (inputValue === 'clear' || inputValue === 'clear()') {
                contentDiv.innerHTML = '';
                privateScope.addToConsole('info', ['Console cleared']);
                input.value = '';
                return;
            }

            if (showFunctionsMatch.test(inputValue)) {
                privateScope.addToConsole('log', [`>${inputValue}`], 'input-default');
                privateScope.showAvailableFunctions();
                input.value = '';
                return;
            }

            if (!allowedCommands.test(inputValue) && !functionCallMatch.test(inputValue)) {
                privateScope.addToConsole('log', [`>${inputValue}`], 'input-default');
                privateScope.addToConsole('error', ['Unsupported command']);
                input.value = '';
                return;
            }

            if (testVariations.test(inputValue)) {
                try {
                    privateScope.addToConsole('log', [inputValue], 'input-test');
                    const fn = window['test'];
                    if (typeof fn === 'function') {
                        const result = fn();
                        privateScope.addToConsole('info', ['Function test complete']);
                        if (result !== undefined) {
                            privateScope.addToConsole('info', ['Result:', result]);
                        }
                    } else {
                        throw new Error('test function not found');
                    }
                } catch (error) {
                    privateScope.addToConsole('log', [inputValue], 'input-test');
                    privateScope.addToConsole('warn', ['Function test incomplete']);
                    privateScope.addToConsole('error', [`Error: ${error.message}`]);
                }
            } else if (/^clearLocalStorage|clearLocalStorage\(\)$/.test(inputValue)) {
                privateScope.clearLocalStorage();
            } else if (/^saveSettings|saveSettings\(\)$/.test(inputValue)) {
                privateScope.saveSettings();
                privateScope.addToConsole('info', ['Settings saved to LocalStorage']);
            } else if (/^loadSettings|loadSettings\(\)$/.test(inputValue)) {
                privateScope.loadSettings();
                privateScope.addToConsole('info', ['Settings loaded from LocalStorage']);
            } else if (/^showSettings|showSettings\(\)$/.test(inputValue)) {
                privateScope.showSettings();
            } else if (functionCallMatch.test(inputValue)) {
                const functionName = functionCallMatch.exec(inputValue)[1];
                try {
                    const normalizedInput = functionName.toLowerCase();
                    let matchingFn;
                    let actualFunctionName = null;
                    for (let key in window) {
                        if (typeof window[key] === 'function' && key.toLowerCase() === normalizedInput) {
                            matchingFn = window[key];
                            actualFunctionName = key;
                            break;
                        }
                    }
                    if (!matchingFn) {
                        for (let key in privateScope) {
                            if (typeof privateScope[key] === 'function' && key.toLowerCase() === normalizedInput) {
                                matchingFn = privateScope[key];
                                actualFunctionName = key;
                                break;
                            }
                        }
                    }
                    if (matchingFn) {
                        privateScope.addToConsole('log', [`>${inputValue}`], 'input-default');
                        const result = matchingFn();
                        if (result !== undefined) {
                            privateScope.addToConsole('info', ['Result:', result]);
                        }
                    } else {
                        privateScope.addToConsole('log', [`>${inputValue}`], 'input-default');
                        privateScope.addToConsole('warn', [`No function found matching ${functionName}`]);
                        throw new Error(`${functionName} is not a function`);
                    }
                } catch (error) {
                    privateScope.addToConsole('log', [`>${inputValue}`], 'input-default');
                    privateScope.addToConsole('warn', [`Function ${functionName} incomplete`]);
                    privateScope.addToConsole('error', [`Error: ${error.message}`]);
                }
            }
            input.value = '';
        }
    });

    document.addEventListener('keydown', function(event) {
        if (event.altKey && (event.key === 'c' || event.key === 'C' || event.keyCode === 67)) {
            event.preventDefault();
            privateScope.loadSettings();
            const wasVisible = consoleDiv.classList.contains('visible');

            if (wasVisible) {
                consoleDiv.classList.remove('visible');
            } else {
                const consoleRect = consoleDiv.getBoundingClientRect();
                const loadingScreenWidth = 300;
                const loadingScreenHeight = 150;

                loadingScreen.style.width = `${loadingScreenWidth}px`;
                loadingScreen.style.height = `${loadingScreenHeight}px`;
                loadingScreen.style.top = `${window.innerHeight / 2 - loadingScreenHeight / 2}px`;
                loadingScreen.style.left = `${window.innerWidth / 2 - loadingScreenWidth / 2}px`;
                loadingScreen.style.display = 'block';

                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                    consoleDiv.classList.add('visible');
                    consoleDiv.style.left = `${currentX}px`;
                    consoleDiv.style.top = `${currentY}px`;
                    privateScope.flushBuffer();
                    hasShownLargeTitle = true;
                }, 1500);
            }
        }
    });

    window.addEventListener('load', function() {
        privateScope.updateAvailableFunctions();
        hasShownLargeTitle = false;
    });
})();