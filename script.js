// Quiz state
let quizData = [];
let originalQuizData = []; // Lưu bản gốc để làm lại
let userAnswers = [];
let currentQuestion = 0;
let quizSubmitted = false;

// Shuffle function (Fisher-Yates algorithm)
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Shuffle options for a single question
function shuffleQuestionOptions(question) {
    const validOptions = question.options
        .map((opt, idx) => ({ text: opt, originalIndex: idx }))
        .filter(opt => opt.text); // Only include non-empty options

    const shuffledOptions = shuffleArray(validOptions);

    const newOptions = [];
    let newCorrectAnswer = -1;

    shuffledOptions.forEach((opt, newIdx) => {
        newOptions[newIdx] = opt.text;
        if (opt.originalIndex === question.correctAnswer) {
            newCorrectAnswer = newIdx;
        }
    });

    return {
        ...question,
        options: newOptions,
        correctAnswer: newCorrectAnswer
    };
}

// Apply shuffle settings to quiz data
function applyShuffleSettings(data) {
    const shuffleQuestions = document.getElementById('shuffle-questions')?.checked ?? false;
    const shuffleAnswers = document.getElementById('shuffle-answers')?.checked ?? false;

    let result = [...data];

    // Shuffle questions order
    if (shuffleQuestions) {
        result = shuffleArray(result);
    }

    // Shuffle options within each question
    if (shuffleAnswers) {
        result = result.map(q => shuffleQuestionOptions(q));
    }

    return result;
}

// Keyboard shortcuts
document.addEventListener('keydown', function (e) {
    // Only handle shortcuts when quiz panel is active
    const quizPanel = document.getElementById('quiz-panel');
    if (!quizPanel || !quizPanel.classList.contains('active')) return;
    if (quizData.length === 0) return;

    // Don't trigger if user is typing in textarea
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

    switch (e.key) {
        case '1':
            if (!quizSubmitted) selectOption(0); // A
            break;
        case '2':
            if (!quizSubmitted) selectOption(1); // B
            break;
        case '3':
            if (!quizSubmitted) selectOption(2); // C
            break;
        case '4':
            if (!quizSubmitted) selectOption(3); // D
            break;
        case 'ArrowLeft':
            prevQuestion();
            e.preventDefault();
            break;
        case 'ArrowRight':
            nextQuestion();
            e.preventDefault();
            break;
        case 'Enter':
            if (!quizSubmitted) {
                submitQuiz();
            } else {
                retryQuiz();
            }
            e.preventDefault();
            break;
    }
});

// Tab switching
function switchTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));

    if (tab === 'create') {
        document.querySelector('.tab:nth-child(1)').classList.add('active');
        document.getElementById('create-panel').classList.add('active');
    } else {
        document.querySelector('.tab:nth-child(2)').classList.add('active');
        document.getElementById('quiz-panel').classList.add('active');
    }
}

// Parse quiz input
function parseQuiz() {
    const input = document.getElementById('quiz-input').value.trim();
    if (!input) {
        alert('Vui lòng nhập nội dung quiz!');
        return;
    }

    quizData = [];
    userAnswers = [];
    currentQuestion = 0;
    quizSubmitted = false;

    // First, try to normalize the input - detect if it's inline format
    let normalizedInput = input;

    // Check if it looks like inline format: line starts with number and contains " A. " pattern
    const hasInlineFormat = input.split('\n').some(line => {
        const trimmed = line.trim();
        return /^\d+\s+.+\s+A\.\s+/.test(trimmed) || /^\d+\s+.+\s+\(A\)\.\s+/.test(trimmed);
    });

    if (hasInlineFormat) {
        normalizedInput = convertInlineToMultiline(input);
    }

    // Split by question numbers (standalone numbers on their own line)
    const lines = normalizedInput.split('\n');
    let currentQ = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Check if this line is a question number
        if (/^\d+\.?$/.test(line)) {
            if (currentQ && currentQ.question && currentQ.options.length > 0) {
                quizData.push(currentQ);
            }
            currentQ = {
                number: parseInt(line),
                question: '',
                options: [],
                correctAnswer: -1
            };
            continue;
        }

        if (!currentQ) continue;

        // Check if this is an option line
        // Must have either: "(A)", "(A).", "A." - NOT just "A" followed by text
        // This prevents questions starting with A, B, C, D from being parsed as options
        const optionMatch = line.match(/^(\()([A-D])(\))\.?\s*(.+)$/) ||  // (A) or (A). format
            line.match(/^()([A-D])()\.(\s*.+)$/);          // A. format (requires dot)

        if (optionMatch) {
            const hasOpenParen = optionMatch[1] === '(';
            const letter = optionMatch[2].toUpperCase();
            const hasCloseParen = optionMatch[3] === ')';
            const text = optionMatch[4].trim();
            const isCorrect = hasOpenParen || hasCloseParen;

            const optionIndex = ['A', 'B', 'C', 'D'].indexOf(letter);
            if (optionIndex !== -1) {
                while (currentQ.options.length < optionIndex) {
                    currentQ.options.push('');
                }
                currentQ.options[optionIndex] = text;

                if (isCorrect) {
                    currentQ.correctAnswer = optionIndex;
                }
            }
        } else if (line && currentQ.options.length === 0) {
            if (currentQ.question) {
                currentQ.question += ' ' + line;
            } else {
                currentQ.question = line;
            }
        }
    }

    // Don't forget the last question
    if (currentQ && currentQ.question && currentQ.options.length > 0) {
        quizData.push(currentQ);
    }

    if (quizData.length === 0) {
        alert('Không tìm thấy câu hỏi hợp lệ. Vui lòng kiểm tra định dạng!');
        return;
    }

    // Lưu bản gốc
    originalQuizData = JSON.parse(JSON.stringify(quizData));

    // Áp dụng shuffle settings
    quizData = applyShuffleSettings(quizData);

    userAnswers = new Array(quizData.length).fill(-1);
    switchTab('quiz');
    renderQuiz();
}

// Convert inline format to multi-line
function convertInlineToMultiline(input) {
    let result = [];
    const lines = input.split('\n');

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) {
            result.push('');
            continue;
        }

        // Match: number + space + rest
        const questionStartMatch = trimmedLine.match(/^(\d+)\.?\s+(.+)$/);

        if (questionStartMatch) {
            const questionNum = questionStartMatch[1];
            let restOfLine = questionStartMatch[2];

            // Find option A - look for standalone "A." or "(A)." preceded by space or question mark
            const optionAPatterns = [
                /^(.+?[\?\.\!\:\;])\s*(\(A\)\.)\s+(.+)$/,
                /^(.+?[\?\.\!\:\;])\s*(A\.)\s+(.+)$/,
                /^(.+?)\s+(\(A\)\.)\s+(.+)$/,
                /^(.+?)\s+(A\.)\s+(.+)$/
            ];

            let matched = false;
            for (const pattern of optionAPatterns) {
                const optionStartMatch = restOfLine.match(pattern);
                if (optionStartMatch) {
                    const questionText = optionStartMatch[1].trim();
                    const optionAMarker = optionStartMatch[2];
                    const restOptions = optionStartMatch[3];

                    result.push(questionNum);
                    result.push(questionText);

                    // Parse all options using explicit matching
                    const fullOptionsText = optionAMarker + ' ' + restOptions;
                    const options = parseOptionsFromText(fullOptionsText);

                    for (const opt of options) {
                        result.push(opt);
                    }

                    matched = true;
                    break;
                }
            }

            if (!matched) {
                result.push(questionNum);
                result.push(restOfLine);
            }
        } else {
            result.push(trimmedLine);
        }

        result.push('');
    }

    return result.join('\n');
}

// Parse options from text like "A. text B. text (C). text D. text"
function parseOptionsFromText(text) {
    const options = [];

    // Pattern to match option markers: A. or (A). or B. or (B). etc. (uppercase only)
    const optionMarkerPattern = /(\(?[A-D]\)?\.)\s*/g;

    let lastIndex = 0;
    let lastMarker = null;
    let match;

    while ((match = optionMarkerPattern.exec(text)) !== null) {
        if (lastMarker !== null) {
            const optionText = text.substring(lastIndex, match.index).trim();
            options.push(lastMarker + ' ' + optionText);
        }
        lastMarker = match[1];
        lastIndex = match.index + match[0].length;
    }

    // Don't forget the last option
    if (lastMarker !== null) {
        const optionText = text.substring(lastIndex).trim();
        options.push(lastMarker + ' ' + optionText);
    }

    return options;
}

// Render quiz UI
function renderQuiz() {
    const container = document.getElementById('quiz-content');
    const noQuiz = document.getElementById('no-quiz');

    if (quizData.length === 0) {
        container.classList.remove('active');
        noQuiz.style.display = 'block';
        return;
    }

    container.classList.add('active');
    noQuiz.style.display = 'none';

    // Đảm bảo currentQuestion nằm trong range hợp lệ
    if (currentQuestion < 0) currentQuestion = 0;
    if (currentQuestion >= quizData.length) currentQuestion = quizData.length - 1;

    const q = quizData[currentQuestion];
    const answered = userAnswers.filter(a => a !== -1).length;
    const progress = (answered / quizData.length) * 100;

    let html = `
        <div class="progress-bar">
            <div class="progress-fill" style="width: ${progress}%"></div>
        </div>

        <div class="question-navigator">
            ${quizData.map((_, i) => {
        let classes = 'nav-dot';
        if (i === currentQuestion) classes += ' current';
        else if (quizSubmitted) {
            if (userAnswers[i] === quizData[i].correctAnswer) {
                classes += ' correct-answer';
            } else {
                classes += ' wrong-answer';
            }
        } else if (userAnswers[i] !== -1) {
            classes += ' answered';
        }
        return `<div class="${classes}" onclick="goToQuestion(${i})">${i + 1}</div>`;
    }).join('')}
        </div>

        <div class="question-card">
            <div class="question-header">
                <span class="question-number">Câu ${currentQuestion + 1}/${quizData.length}</span>
                <span class="question-status">${answered}/${quizData.length} đã trả lời</span>
            </div>
            <div class="question-text">${escapeHtml(q.question)}</div>
            <div class="options">
                ${['A', 'B', 'C', 'D'].map((letter, i) => {
        if (!q.options[i]) return '';

        let classes = 'option';
        let icon = '';

        if (quizSubmitted) {
            classes += ' disabled';
            if (i === q.correctAnswer) {
                classes += ' correct show-correct';
                icon = '<span class="option-icon">✓</span>';
            } else if (userAnswers[currentQuestion] === i) {
                classes += ' incorrect';
                icon = '<span class="option-icon">✗</span>';
            }
        } else if (userAnswers[currentQuestion] === i) {
            classes += ' selected';
        }

        return `
                        <div class="${classes}" onclick="selectOption(${i})">
                            <span class="option-letter">${letter}</span>
                            <span class="option-text">${escapeHtml(q.options[i])}</span>
                            ${icon}
                        </div>
                    `;
    }).join('')}
            </div>
        </div>

        <div class="quiz-nav">
            <button class="btn btn-secondary" onclick="prevQuestion()" ${currentQuestion === 0 ? 'disabled' : ''}>
                ← Câu trước
            </button>
            
            ${!quizSubmitted ? `
                <button class="btn btn-success" onclick="submitQuiz()">
                    📊 Nộp bài
                </button>
            ` : `
                <button class="btn btn-primary" onclick="retryQuiz()">
                    🔄 Làm lại
                </button>
            `}
            
            <button class="btn btn-secondary" onclick="nextQuestion()" ${currentQuestion === quizData.length - 1 ? 'disabled' : ''}>
                Câu sau →
            </button>
        </div>
    `;

    if (quizSubmitted) {
        const correct = userAnswers.filter((a, i) => a === quizData[i].correctAnswer).length;
        const percentage = Math.round((correct / quizData.length) * 100);
        let scoreClass = 'needs-work';
        let emoji = '😢';

        if (percentage >= 80) {
            scoreClass = 'excellent';
            emoji = '🎉';
        } else if (percentage >= 50) {
            scoreClass = 'good';
            emoji = '👍';
        }

        html += `
            <div class="card results-card">
                <div class="results-icon">${emoji}</div>
                <div class="results-score ${scoreClass}">${percentage}%</div>
                <div class="results-detail">
                    Bạn trả lời đúng ${correct}/${quizData.length} câu hỏi
                </div>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value" style="color: var(--success);">${correct}</div>
                        <div class="stat-label">Đúng</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" style="color: var(--error);">${quizData.length - correct}</div>
                        <div class="stat-label">Sai</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${quizData.length}</div>
                        <div class="stat-label">Tổng câu</div>
                    </div>
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
}

// Quiz interaction functions
function selectOption(index) {
    if (quizSubmitted) return;
    userAnswers[currentQuestion] = index;
    renderQuiz();
}

function goToQuestion(index) {
    currentQuestion = index;
    renderQuiz();
}

function prevQuestion() {
    if (currentQuestion > 0) {
        currentQuestion--;
        renderQuiz();
    }
}

function nextQuestion() {
    if (currentQuestion < quizData.length - 1) {
        currentQuestion++;
        renderQuiz();
    }
}

function submitQuiz() {
    const unanswered = userAnswers.filter(a => a === -1).length;

    if (unanswered > 0) {
        if (!confirm(`Bạn còn ${unanswered} câu chưa trả lời. Bạn có chắc muốn nộp bài?`)) {
            return;
        }
    }

    quizSubmitted = true;
    currentQuestion = 0;
    renderQuiz();
}

function retryQuiz() {
    // Xào lại bài nếu cần
    if (originalQuizData.length > 0) {
        quizData = applyShuffleSettings(originalQuizData);
    }

    userAnswers = new Array(quizData.length).fill(-1);
    currentQuestion = 0;
    quizSubmitted = false;
    renderQuiz();
}

// Sample data
function loadSample() {
    document.getElementById('quiz-input').value = `1 Thủ đô của Việt Nam là thành phố nào? A. Hồ Chí Minh (B). Hà Nội C. Đà Nẵng D. Huế
2 Việt Nam có bao nhiêu tỉnh thành? A. 58 tỉnh thành B. 60 tỉnh thành (C). 63 tỉnh thành D. 65 tỉnh thành
3 Sông dài nhất Việt Nam là sông nào? A. Sông Hồng B. Sông Đà C. Sông Cửu Long (D). Sông Mê Kông
4 Ngọn núi cao nhất Việt Nam là núi nào? (A). Fansipan B. Bà Đen C. Ngọc Linh D. Phu Si Lung
5 Việt Nam giành độc lập năm nào? A. 1940 B. 1944 (C). 1945 D. 1946`;
}

function clearInput() {
    document.getElementById('quiz-input').value = '';
}

// Utility
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
