const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
module.exports = app;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public", { fallthrough: true }));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../index.html"))
})

// Setup multer for file uploads
const uploadDir = "public/uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "profile-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp|pdf|doc|docx|ppt|pptx/;
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase(),
    );

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 100MB limit
});

const db = new sqlite3.Database("./database/rebyuhub.db");
db.run("PRAGMA foreign_keys = ON");

const dbRun = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
        return;
      }

      resolve({
        lastID: this.lastID,
        changes: this.changes,
      });
    });
  });

const dbGet = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(row);
    });
  });

const dbAll = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(rows);
    });
  });

async function ensureColumn(tableName, columnName, definition) {
  const columns = await dbAll(`PRAGMA table_info(${tableName})`);
  const hasColumn = columns.some((column) => column.name === columnName);

  if (!hasColumn) {
    await dbRun(
      `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`,
    );
  }
}

async function initializeQuizSchema() {
  await dbRun(`
    CREATE TABLE IF NOT EXISTS question_options(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL,
      option_text TEXT NOT NULL,
      is_correct INTEGER DEFAULT 0 CHECK (is_correct IN (0, 1)),
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS user_answers(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      selected_option_id INTEGER NOT NULL,
      is_correct INTEGER DEFAULT 0 CHECK (is_correct IN (0, 1)),
      FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
      FOREIGN KEY (selected_option_id) REFERENCES question_options(id) ON DELETE CASCADE
    )
  `);

  await ensureColumn("quizzes", "description", "TEXT");
  await ensureColumn("quizzes", "created_by", "INTEGER");
  await ensureColumn("quizzes", "timer_enabled", "INTEGER DEFAULT 0");
  await ensureColumn("quizzes", "order_mode", "TEXT DEFAULT 'ordered'");
  await ensureColumn("questions", "points", "INTEGER DEFAULT 1");
  await ensureColumn(
    "questions",
    "question_type",
    "TEXT DEFAULT 'multiple_choice'",
  );
  await ensureColumn("questions", "is_required", "INTEGER DEFAULT 0");
  await ensureColumn("quiz_attempts", "finished_at", "DATETIME");

  await dbRun(
    "CREATE INDEX IF NOT EXISTS idx_question_options_question_id ON question_options(question_id)",
  );
  await dbRun(
    "CREATE INDEX IF NOT EXISTS idx_user_answers_attempt_id ON user_answers(attempt_id)",
  );
  await dbRun(
    "CREATE INDEX IF NOT EXISTS idx_user_answers_question_id ON user_answers(question_id)",
  );
  await dbRun(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_user_answers_attempt_question ON user_answers(attempt_id, question_id)",
  );

  await dbRun(
    `
    UPDATE quizzes
    SET created_by = uploaded_by
    WHERE created_by IS NULL AND uploaded_by IS NOT NULL
    `,
  );

  await dbRun(
    `
    UPDATE quiz_attempts
    SET finished_at = completed_at
    WHERE finished_at IS NULL AND completed_at IS NOT NULL
    `,
  );
}

async function initializeBaseSchema() {
  await dbRun(`
    CREATE TABLE IF NOT EXISTS users(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fullname TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      birthdate TEXT NOT NULL,
      gender TEXT NOT NULL,
      program TEXT NOT NULL,
      yearLevel TEXT NOT NULL,
      university TEXT NOT NULL,
      profile_picture TEXT,
      bio TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS reviewers(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      file_path TEXT,
      file_size INTEGER,
      category TEXT,
      uploaded_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS quizzes(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT,
      question_count INTEGER DEFAULT 0 CHECK (question_count >= 0),
      uploaded_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS questions(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL,
      question_text TEXT NOT NULL,
      option_a TEXT NOT NULL,
      option_b TEXT NOT NULL,
      option_c TEXT,
      option_d TEXT,
      correct_answer TEXT NOT NULL CHECK (correct_answer IN ('A', 'B', 'C', 'D')),
      question_order INTEGER DEFAULT 0 CHECK (question_order >= 0),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS quiz_attempts(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      score INTEGER DEFAULT 0 CHECK (score >= 0),
      total_questions INTEGER DEFAULT 0 CHECK (total_questions >= 0),
      status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS quiz_answers(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      selected_answer TEXT CHECK (selected_answer IS NULL OR selected_answer IN ('A', 'B', 'C', 'D')),
      is_correct INTEGER DEFAULT 0 CHECK (is_correct IN (0, 1)),
      answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (attempt_id, question_id),
      FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
    )
  `);

  await dbRun(
    "CREATE INDEX IF NOT EXISTS idx_quizzes_uploaded_by ON quizzes(uploaded_by)",
  );
  await dbRun(
    "CREATE INDEX IF NOT EXISTS idx_quizzes_category ON quizzes(category)",
  );
  await dbRun(
    "CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON questions(quiz_id)",
  );
  await dbRun(
    "CREATE INDEX IF NOT EXISTS idx_questions_quiz_order ON questions(quiz_id, question_order)",
  );
  await dbRun(
    "CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id ON quiz_attempts(quiz_id)",
  );
  await dbRun(
    "CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON quiz_attempts(user_id)",
  );
  await dbRun(
    "CREATE INDEX IF NOT EXISTS idx_quiz_answers_attempt_id ON quiz_answers(attempt_id)",
  );
  await dbRun(
    "CREATE INDEX IF NOT EXISTS idx_quiz_answers_question_id ON quiz_answers(question_id)",
  );
  await dbRun(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_quiz_answers_attempt_question ON quiz_answers(attempt_id, question_id)",
  );
}

const validAnswerChoices = ["A", "B", "C", "D"];

function normalizeAnswerChoice(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return validAnswerChoices.includes(normalized) ? normalized : null;
}

function toOptionalText(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

function formatDuration(startedAt, finishedAt) {
  if (!startedAt || !finishedAt) {
    return "0s";
  }

  const startTime = new Date(startedAt).getTime();
  const endTime = new Date(finishedAt).getTime();

  if (
    Number.isNaN(startTime) ||
    Number.isNaN(endTime) ||
    endTime <= startTime
  ) {
    return "0s";
  }

  const totalSeconds = Math.round((endTime - startTime) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes <= 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

function parseSqliteTimestamp(value) {
  if (!value) {
    return null;
  }

  const normalized = String(value).trim().replace(" ", "T");
  const withTimezone = /[zZ]|[+-]\d{2}:\d{2}$/.test(normalized)
    ? normalized
    : `${normalized}Z`;
  const parsed = new Date(withTimezone);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toLocalDateKey(value) {
  const parsed = parseSqliteTimestamp(value);

  if (!parsed) {
    return "";
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function shuffleArray(items) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    const temp = shuffled[index];
    shuffled[index] = shuffled[randomIndex];
    shuffled[randomIndex] = temp;
  }

  return shuffled;
}

function normalizeQuestionInput(question, fallbackOrder = 0) {
  const questionText = toOptionalText(question?.questionText);
  const optionA = toOptionalText(question?.optionA);
  const optionB = toOptionalText(question?.optionB);
  const optionC = toOptionalText(question?.optionC);
  const optionD = toOptionalText(question?.optionD);
  const correctAnswer = normalizeAnswerChoice(question?.correctAnswer);

  if (!questionText || !optionA || !optionB || !correctAnswer) {
    return {
      valid: false,
      message:
        "Each question requires questionText, optionA, optionB, and correctAnswer",
    };
  }

  if (correctAnswer === "C" && !optionC) {
    return {
      valid: false,
      message: "Questions with correctAnswer C must include optionC",
    };
  }

  if (correctAnswer === "D" && !optionD) {
    return {
      valid: false,
      message: "Questions with correctAnswer D must include optionD",
    };
  }

  const parsedOrder = Number.isInteger(Number(question?.questionOrder))
    ? Number(question.questionOrder)
    : fallbackOrder;

  return {
    valid: true,
    value: {
      questionText,
      optionA,
      optionB,
      optionC,
      optionD,
      correctAnswer,
      questionOrder: parsedOrder >= 0 ? parsedOrder : fallbackOrder,
    },
  };
}

async function refreshQuizQuestionCount(quizId) {
  await dbRun(
    `
    UPDATE quizzes
    SET question_count = (
      SELECT COUNT(*)
      FROM questions
      WHERE questions.quiz_id = quizzes.id
    )
    WHERE id = ?
    `,
    [quizId],
  );
}

function validateQuestionOptions(options, questionType = "multiple_choice") {
  if (!Array.isArray(options) || options.length === 0) {
    return {
      valid: false,
      message: "Each question must include answer data",
    };
  }

  const normalizedOptions = options
    .map((option) => ({
      optionText: toOptionalText(option?.optionText),
      isCorrect: Number(option?.isCorrect) === 1 || option?.isCorrect === true,
    }))
    .filter((option) => option.optionText);

  if (questionType !== "short_answer" && normalizedOptions.length < 2) {
    return {
      valid: false,
      message: "Each question must have at least 2 non-empty answer options",
    };
  }

  const correctCount = normalizedOptions.filter(
    (option) => option.isCorrect,
  ).length;

  if (questionType === "multiple_choice" && correctCount !== 1) {
    return {
      valid: false,
      message: "Each question must have exactly 1 correct answer",
    };
  }

  if (questionType === "checkboxes" && correctCount < 1) {
    return {
      valid: false,
      message: "Checkbox questions must have at least 1 correct answer",
    };
  }

  if (questionType === "short_answer") {
    if (normalizedOptions.length !== 1 || correctCount !== 1) {
      return {
        valid: false,
        message: "Short answer questions require 1 accepted correct answer",
      };
    }
  }

  return {
    valid: true,
    value: normalizedOptions,
  };
}

function normalizeStructuredQuestion(question, fallbackOrder = 1) {
  const questionText = toOptionalText(question?.questionText);
  const questionType = [
    "multiple_choice",
    "checkboxes",
    "short_answer",
  ].includes(question?.questionType)
    ? question.questionType
    : "multiple_choice";
  const points = Number.isInteger(Number(question?.points))
    ? Number(question.points)
    : 1;
  const required =
    Number(question?.required) === 1 || question?.required === true;
  const parsedOrder = Number.isInteger(Number(question?.questionOrder))
    ? Number(question.questionOrder)
    : fallbackOrder;
  const optionsResult = validateQuestionOptions(
    question?.options,
    questionType,
  );

  if (!questionText) {
    return {
      valid: false,
      message: "Each question requires questionText",
    };
  }

  if (!optionsResult.valid) {
    return optionsResult;
  }

  return {
    valid: true,
    value: {
      questionText,
      questionType,
      points: points > 0 ? points : 1,
      required,
      questionOrder: parsedOrder >= 1 ? parsedOrder : fallbackOrder,
      options: optionsResult.value,
    },
  };
}

function hasDuplicateQuestionOrders(questions) {
  const usedOrders = new Set();

  for (const question of questions) {
    if (usedOrders.has(question.questionOrder)) {
      return true;
    }

    usedOrders.add(question.questionOrder);
  }

  return false;
}

async function getQuizById(quizId) {
  return dbGet(
    `
    SELECT
      quizzes.id,
      quizzes.title,
      quizzes.description,
      quizzes.category,
      quizzes.timer_enabled,
      quizzes.order_mode,
      quizzes.question_count,
      quizzes.created_by,
      quizzes.created_at,
      users.username AS creator_username
    FROM quizzes
    LEFT JOIN users
      ON quizzes.created_by = users.id
    WHERE quizzes.id = ?
    `,
    [quizId],
  );
}

async function getQuestionsWithOptions(quizId) {
  const questions = await dbAll(
    `
    SELECT
      id,
      quiz_id,
      question_text,
      points,
      question_type,
      is_required,
      question_order,
      created_at
    FROM questions
    WHERE quiz_id = ?
    ORDER BY question_order ASC, id ASC
    `,
    [quizId],
  );

  const questionIds = questions.map((question) => question.id);

  if (questionIds.length === 0) {
    return [];
  }

  const placeholders = questionIds.map(() => "?").join(", ");
  const options = await dbAll(
    `
    SELECT
      id,
      question_id,
      option_text,
      is_correct
    FROM question_options
    WHERE question_id IN (${placeholders})
    ORDER BY id ASC
    `,
    questionIds,
  );

  const optionsByQuestion = new Map();

  options.forEach((option) => {
    if (!optionsByQuestion.has(option.question_id)) {
      optionsByQuestion.set(option.question_id, []);
    }

    optionsByQuestion.get(option.question_id).push(option);
  });

  return questions.map((question) => ({
    ...question,
    options: optionsByQuestion.get(question.id) || [],
  }));
}

async function createQuestionRecord(quizId, question) {
  const legacyOptions = question.options.slice(0, 4);
  const optionA =
    legacyOptions[0]?.optionText || question.options[0].optionText;
  const optionB =
    legacyOptions[1]?.optionText || question.options[0].optionText;
  const optionC = legacyOptions[2]?.optionText || null;
  const optionD = legacyOptions[3]?.optionText || null;
  const correctIndex = legacyOptions.findIndex((option) => option.isCorrect);
  const legacyAnswer = validAnswerChoices[Math.max(correctIndex, 0)] || "A";

  const insertQuestion = await dbRun(
    `
    INSERT INTO questions(
      quiz_id,
      question_text,
      points,
      question_type,
      is_required,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_answer,
      question_order
    )
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      quizId,
      question.questionText,
      question.points || 1,
      question.questionType || "multiple_choice",
      question.required ? 1 : 0,
      optionA,
      optionB,
      optionC,
      optionD,
      legacyAnswer,
      question.questionOrder,
    ],
  );

  for (const option of question.options) {
    await dbRun(
      `
      INSERT INTO question_options(question_id, option_text, is_correct)
      VALUES(?, ?, ?)
      `,
      [insertQuestion.lastID, option.optionText, option.isCorrect ? 1 : 0],
    );
  }

  return insertQuestion.lastID;
}

app.post("/api/register", upload.single("profilePicture"), (req, res) => {
  const {
    fullname,
    username,
    email,
    password,
    birthdate,
    gender,
    program,
    yearLevel,
    university,
  } = req.body;

  const profilePicture = req.file ? `/uploads/${req.file.filename}` : null;

  if (
    !fullname ||
    !username ||
    !email ||
    !password ||
    !birthdate ||
    !gender ||
    !program ||
    !yearLevel ||
    !university
  ) {
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }

    return res.json({
      success: false,
      message: "Missing required fields",
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }

    return res.json({
      success: false,
      message: "Invalid email format",
    });
  }

  if (password.length < 6) {
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }

    return res.json({
      success: false,
      message: "Password must be at least 6 characters",
    });
  }

  const sql = `
  INSERT INTO users
  (fullname,username,email,password,birthdate,gender,program,yearLevel,university,profile_picture)
  VALUES(?,?,?,?,?,?,?,?,?,?)
  `;

  db.run(
    sql,
    [
      fullname,
      username,
      email,
      password,
      birthdate,
      gender,
      program,
      yearLevel,
      university,
      profilePicture,
    ],
    function (err) {
      if (err) {
        console.error("Register error:", err);

        if (req.file) {
          fs.unlink(req.file.path, () => {});
        }

        if (err.message.includes("UNIQUE")) {
          return res.json({
            success: false,
            message: "Username or email already exists",
          });
        }

        return res.json({
          success: false,
          message: "Database error",
        });
      }

      res.json({
        success: true,
        message: "Registration successful",
        userId: this.lastID,
      });
    },
  );
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  // Validate required fields
  if (!username || !password) {
    return res.json({
      success: false,
      message: "Missing username or password",
    });
  }

  const sql =
    "SELECT id, fullname, username, email, birthdate, gender, program, yearLevel, university, profile_picture, bio, createdAt FROM users WHERE username = ? AND password = ?";

  db.get(sql, [username, password], (err, row) => {
    if (err) {
      console.error("Login query error:", err);
      return res.json({
        success: false,
        message: "Database error",
      });
    }

    if (row) {
      res.json({
        success: true,
        message: "Login successful",
        user: {
          id: row.id,
          fullname: row.fullname,
          username: row.username,
          email: row.email,
          birthdate: row.birthdate,
          gender: row.gender,
          program: row.program,
          yearLevel: row.yearLevel,
          university: row.university,
          profile_picture: row.profile_picture,
          bio: row.bio,
          createdAt: row.createdAt,
        },
      });
    } else {
      res.json({
        success: false,
        message: "Invalid username or password",
      });
    }
  });
});

app.post(
  "/api/upload-profile-picture",
  upload.single("profilePicture"),
  (req, res) => {
    const userId = req.body.userId;

    if (!req.file || !userId) {
      return res.json({
        success: false,
        message: "Missing file or user ID",
      });
    }

    const profilePicturePath = `/uploads/${req.file.filename}`;

    const sql = "UPDATE users SET profile_picture = ? WHERE id = ?";

    db.run(sql, [profilePicturePath, userId], function (err) {
      if (err) {
        console.error("Profile picture update error:", err);
        return res.json({
          success: false,
          message: "Failed to update profile picture",
        });
      }

      res.json({
        success: true,
        profilePicture: profilePicturePath,
      });
    });
  },
);

app.post("/api/update-bio", (req, res) => {
  const { userId, bio } = req.body;

  if (!userId || bio === undefined) {
    return res.json({
      success: false,
      message: "Missing user ID or bio",
    });
  }

  if (bio.length > 200) {
    return res.json({
      success: false,
      message: "Bio cannot exceed 200 characters",
    });
  }

  const sql = "UPDATE users SET bio = ? WHERE id = ?";

  db.run(sql, [bio, userId], function (err) {
    if (err) {
      console.error("Update bio error:", err);
      return res.json({
        success: false,
        message: "Failed to update bio",
      });
    }

    res.json({
      success: true,
      message: "Bio updated successfully",
      bio: bio,
    });
  });
});

app.post("/api/upload-reviewer", upload.single("file"), (req, res) => {
  const { title, category, userId } = req.body;

  if (!req.file) {
    return res.json({
      success: false,
      message: "No file uploaded",
    });
  }

  const filePath = `/uploads/${req.file.filename}`;

  const fileSize = req.file.size;

  const finalTitle =
    title && title.trim() !== ""
      ? title
      : req.file.originalname.replace(/\.[^/.]+$/, "");

  const sql = `
  INSERT INTO reviewers(title,file_path,file_size,category,uploaded_by)
  VALUES(?,?,?,?,?)
  `;

  db.run(
    sql,
    [finalTitle, filePath, fileSize, category, userId],
    function (err) {
      if (err) {
        console.error(err);
        return res.json({ success: false });
      }

      res.json({
        success: true,
        id: this.lastID,
        title: finalTitle,
        filePath,
        fileSize,
        category,
      });
    },
  );
});

app.post("/api/update-fullname", (req, res) => {
  const { id, fullname } = req.body;

  if (!id || !fullname) {
    return res.json({ success: false });
  }

  const sql = "UPDATE users SET fullname=? WHERE id=?";

  db.run(sql, [fullname, id], function (err) {
    if (err) {
      console.error(err);
      return res.json({ success: false });
    }

    res.json({ success: true });
  });
});

app.post("/api/update-username", (req, res) => {
  const { id, username } = req.body;

  if (!id || !username) {
    return res.json({ success: false });
  }

  const sql = "UPDATE users SET username=? WHERE id=?";

  db.run(sql, [username, id], function (err) {
    if (err) {
      console.error(err);
      return res.json({
        success: false,
        message: "Username already exists",
      });
    }

    res.json({ success: true });
  });
});

app.post("/api/update-email", (req, res) => {
  const { id, email } = req.body;

  if (!id || !email) {
    return res.json({
      success: false,
      message: "Missing user ID or email",
    });
  }

  const trimmedEmail = String(email).trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(trimmedEmail)) {
    return res.json({
      success: false,
      message: "Invalid email format",
    });
  }

  const sql = "UPDATE users SET email=? WHERE id=?";

  db.run(sql, [trimmedEmail, id], function (err) {
    if (err) {
      console.error(err);

      if (err.message.includes("UNIQUE")) {
        return res.json({
          success: false,
          message: "Email already exists",
        });
      }

      return res.json({
        success: false,
        message: "Failed to update email",
      });
    }

    res.json({ success: true });
  });
});

app.post("/api/update-password", (req, res) => {
  const { id, currentPassword, newPassword } = req.body;

  if (!id || !currentPassword || !newPassword) {
    return res.json({ success: false });
  }

  const sql = "SELECT password FROM users WHERE id=?";

  db.get(sql, [id], (err, row) => {
    if (err || !row) {
      return res.json({ success: false });
    }

    if (row.password !== currentPassword) {
      return res.json({
        success: false,
        message: "Incorrect password",
      });
    }

    db.run(
      "UPDATE users SET password=? WHERE id=?",
      [newPassword, id],
      function (err) {
        if (err) {
          return res.json({ success: false });
        }

        res.json({ success: true });
      },
    );
  });
});

app.get("/api/reviewer-categories", (req, res) => {
  const sql = `
  SELECT DISTINCT category
  FROM reviewers
  ORDER BY category
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.json({ success: false });
    }

    res.json({
      success: true,
      categories: rows,
    });
  });
});

app.get("/api/reviewers", (req, res) => {
  const sql = `
  SELECT
  reviewers.*,
  users.username AS uploader
  FROM reviewers
  LEFT JOIN users
  ON reviewers.uploaded_by = users.id
  ORDER BY reviewers.created_at DESC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.json({ success: false });
    }

    res.json({
      success: true,
      reviewers: rows,
    });
  });
});

app.delete("/api/reviewer/:id", (req, res) => {
  const id = req.params.id;

  db.run("DELETE FROM reviewers WHERE id=?", [id], function (err) {
    if (err) {
      return res.json({ success: false });
    }

    res.json({ success: true });
  });
});

app.post("/api/rename-reviewer", (req, res) => {
  const { id, title } = req.body;

  db.run(
    "UPDATE reviewers SET title=? WHERE id=?",
    [title, id],
    function (err) {
      if (err) {
        return res.json({ success: false });
      }

      res.json({ success: true });
    },
  );
});

app.get("/api/user/:id", (req, res) => {
  const sql = "SELECT profile_picture FROM users WHERE id=?";

  db.get(sql, [req.params.id], (err, row) => {
    if (err) {
      return res.json({ success: false });
    }

    if (!row) {
      return res.json({
        success: false,
        message: "User not found",
        profile: null,
      });
    }

    res.json({
      success: true,
      profile: row.profile_picture,
    });
  });
});

app.get("/api/users/:id/profile-summary", async (req, res) => {
  const userId = Number(req.params.id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.json({
      success: false,
      message: "Invalid user id",
    });
  }

  try {
    const user = await dbGet(
      `
      SELECT
        id,
        fullname,
        username,
        email,
        birthdate,
        gender,
        program,
        yearLevel,
        university,
        profile_picture,
        bio,
        createdAt
      FROM users
      WHERE id = ?
      `,
      [userId],
    );

    if (!user) {
      return res.json({
        success: false,
        message: "User not found",
      });
    }

    const stats = await dbGet(
      `
      SELECT
        (SELECT COUNT(*) FROM reviewers WHERE uploaded_by = ?) AS reviewer_count,
        (SELECT COUNT(*) FROM quizzes WHERE created_by = ?) AS created_quiz_count,
        (
          SELECT COUNT(*)
          FROM quiz_attempts
          WHERE user_id = ?
            AND status = 'completed'
        ) AS completed_attempt_count,
        (
          SELECT ROUND(AVG(
            CASE
              WHEN total_questions > 0 THEN (score * 100.0) / total_questions
              ELSE 0
            END
          ), 0)
          FROM quiz_attempts
          WHERE user_id = ?
            AND status = 'completed'
        ) AS average_score
      `,
      [userId, userId, userId, userId],
    );

    const recentReviewers = await dbAll(
      `
      SELECT
        id,
        title,
        category,
        created_at
      FROM reviewers
      WHERE uploaded_by = ?
      ORDER BY datetime(created_at) DESC, id DESC
      LIMIT 4
      `,
      [userId],
    );

    const recentQuizzes = await dbAll(
      `
      SELECT
        id,
        title,
        category,
        created_at,
        (
          SELECT COUNT(*)
          FROM questions
          WHERE questions.quiz_id = quizzes.id
        ) AS question_count
      FROM quizzes
      WHERE created_by = ?
      ORDER BY datetime(created_at) DESC, id DESC
      LIMIT 4
      `,
      [userId],
    );

    res.json({
      success: true,
      user,
      stats: {
        reviewerCount: Number(stats?.reviewer_count || 0),
        createdQuizCount: Number(stats?.created_quiz_count || 0),
        completedAttemptCount: Number(stats?.completed_attempt_count || 0),
        averageScore: Number(stats?.average_score || 0),
      },
      recentReviewers,
      recentQuizzes,
    });
  } catch (err) {
    console.error(err);
    res.json({
      success: false,
      message: "Failed to load profile summary",
    });
  }
});

app.get("/api/users/:id/settings", (req, res) => {
  const userId = Number(req.params.id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.json({
      success: false,
      message: "Invalid user id",
    });
  }

  db.get(
    `
    SELECT
      id,
      fullname,
      username,
      email
    FROM users
    WHERE id = ?
    `,
    [userId],
    (err, row) => {
      if (err) {
        console.error(err);
        return res.json({
          success: false,
          message: "Failed to load settings data",
        });
      }

      if (!row) {
        return res.json({
          success: false,
          message: "User not found",
        });
      }

      res.json({
        success: true,
        user: row,
      });
    },
  );
});

app.get("/api/quiz-categories", async (req, res) => {
  try {
    const categories = await dbAll(
      `
      SELECT DISTINCT category
      FROM quizzes
      WHERE category IS NOT NULL AND TRIM(category) != ''
      ORDER BY category
      `,
    );

    res.json({
      success: true,
      categories,
    });
  } catch (err) {
    console.error(err);
    res.json({ success: false });
  }
});

app.get("/api/quizzes", async (req, res) => {
  try {
    const quizzes = await dbAll(
      `
      SELECT
        quizzes.id,
        quizzes.title,
        quizzes.description,
        quizzes.category,
        (
          SELECT COUNT(*)
          FROM questions
          WHERE questions.quiz_id = quizzes.id
        ) AS question_count,
        quizzes.created_by,
        quizzes.created_at,
        users.username AS creator_username
      FROM quizzes
      LEFT JOIN users
        ON quizzes.created_by = users.id
      ORDER BY quizzes.created_at DESC
      `,
    );

    res.json({
      success: true,
      quizzes,
    });
  } catch (err) {
    console.error(err);
    res.json({ success: false });
  }
});

app.get("/api/users/:userId/completed-quizzes", async (req, res) => {
  const userId = Number(req.params.userId);

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.json({
      success: false,
      message: "A valid user id is required",
    });
  }

  try {
    const rows = await dbAll(
      `
      SELECT DISTINCT quiz_id
      FROM quiz_attempts
      WHERE user_id = ?
        AND status = 'completed'
      `,
      [userId],
    );

    res.json({
      success: true,
      quizIds: rows.map((row) => row.quiz_id),
    });
  } catch (err) {
    console.error(err);
    res.json({
      success: false,
      message: "Failed to load completed quizzes",
    });
  }
});

app.get("/api/users/:userId/progress-summary", async (req, res) => {
  const userId = Number(req.params.userId);

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.json({
      success: false,
      message: "A valid user id is required",
    });
  }

  try {
    const attempts = await dbAll(
      `
      SELECT
        quiz_attempts.id,
        quiz_attempts.quiz_id,
        quiz_attempts.score,
        quiz_attempts.total_questions,
        COALESCE(quiz_attempts.finished_at, quiz_attempts.completed_at) AS finished_at,
        quizzes.title AS quiz_title,
        quizzes.category AS quiz_category,
        ROUND(
          CASE
            WHEN quiz_attempts.total_questions > 0
            THEN (quiz_attempts.score * 100.0) / quiz_attempts.total_questions
            ELSE 0
          END,
          0
        ) AS percentage
      FROM quiz_attempts
      LEFT JOIN quizzes
        ON quiz_attempts.quiz_id = quizzes.id
      WHERE quiz_attempts.user_id = ?
        AND quiz_attempts.status = 'completed'
      ORDER BY datetime(COALESCE(quiz_attempts.finished_at, quiz_attempts.completed_at)) DESC, quiz_attempts.id DESC
      `,
      [userId],
    );

    const totalCompleted = attempts.length;
    const averageScore = totalCompleted
      ? Math.round(
          attempts.reduce(
            (sum, attempt) => sum + Number(attempt.percentage || 0),
            0,
          ) / totalCompleted,
        )
      : 0;
    const bestScore = totalCompleted
      ? Math.max(...attempts.map((attempt) => Number(attempt.percentage || 0)))
      : 0;

    const uniqueStudyDays = [
      ...new Set(
        attempts
          .map((attempt) => toLocalDateKey(attempt.finished_at))
          .filter(Boolean),
      ),
    ].sort((left, right) => right.localeCompare(left));

    let studyStreak = 0;

    for (let index = 0; index < uniqueStudyDays.length; index += 1) {
      if (index === 0) {
        studyStreak = 1;
        continue;
      }

      const previous = new Date(`${uniqueStudyDays[index - 1]}T00:00:00`);
      const current = new Date(`${uniqueStudyDays[index]}T00:00:00`);
      const diffDays = Math.round((previous - current) / 86400000);

      if (diffDays === 1) {
        studyStreak += 1;
      } else {
        break;
      }
    }

    const weekly = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let index = 6; index >= 0; index -= 1) {
      const day = new Date(today);
      day.setDate(today.getDate() - index);

      const year = day.getFullYear();
      const month = String(day.getMonth() + 1).padStart(2, "0");
      const dayOfMonth = String(day.getDate()).padStart(2, "0");
      const dateKey = `${year}-${month}-${dayOfMonth}`;
      const dayAttempts = attempts.filter(
        (attempt) => toLocalDateKey(attempt.finished_at) === dateKey,
      );
      const averagePercentage = dayAttempts.length
        ? Math.round(
            dayAttempts.reduce(
              (sum, attempt) => sum + Number(attempt.percentage || 0),
              0,
            ) / dayAttempts.length,
          )
        : 0;

      weekly.push({
        label: day.toLocaleDateString("en-US", { weekday: "short" }),
        dateKey,
        attemptCount: dayAttempts.length,
        averagePercentage,
      });
    }

    const categoryMap = new Map();

    attempts.forEach((attempt) => {
      const key = attempt.quiz_category || "General";

      if (!categoryMap.has(key)) {
        categoryMap.set(key, {
          category: key,
          totalPercentage: 0,
          attempts: 0,
        });
      }

      const entry = categoryMap.get(key);
      entry.totalPercentage += Number(attempt.percentage || 0);
      entry.attempts += 1;
    });

    const categoryPerformance = [...categoryMap.values()]
      .map((entry) => ({
        category: entry.category,
        averagePercentage: Math.round(entry.totalPercentage / entry.attempts),
        attempts: entry.attempts,
      }))
      .sort((left, right) => {
        if (right.averagePercentage !== left.averagePercentage) {
          return right.averagePercentage - left.averagePercentage;
        }

        return right.attempts - left.attempts;
      })
      .slice(0, 5);

    res.json({
      success: true,
      summary: {
        totalCompleted,
        averageScore,
        bestScore,
        studyStreak,
      },
      weekly,
      recentAttempts: attempts.slice(0, 6),
      categoryPerformance,
    });
  } catch (err) {
    console.error(err);
    res.json({
      success: false,
      message: "Failed to load progress summary",
    });
  }
});

app.get("/api/quizzes/:id", async (req, res) => {
  try {
    const quiz = await getQuizById(req.params.id);

    if (!quiz) {
      return res.json({
        success: false,
        message: "Quiz not found",
      });
    }

    const questions = await getQuestionsWithOptions(req.params.id);

    res.json({
      success: true,
      quiz,
      questions,
    });
  } catch (err) {
    console.error(err);
    res.json({ success: false });
  }
});

app.post("/api/quizzes", async (req, res) => {
  const title = toOptionalText(req.body.title);
  const category = toOptionalText(req.body.category);
  const userId = Number(req.body.userId);
  const rawQuestions = Array.isArray(req.body.questions)
    ? req.body.questions
    : [];

  if (!title || !Number.isInteger(userId) || userId <= 0) {
    return res.json({
      success: false,
      message: "title and valid userId are required",
    });
  }

  const user = await dbGet("SELECT id FROM users WHERE id = ?", [userId]).catch(
    (err) => {
      console.error(err);
      return null;
    },
  );

  if (!user) {
    return res.json({
      success: false,
      message: "User not found",
    });
  }

  const normalizedQuestions = [];

  for (let index = 0; index < rawQuestions.length; index += 1) {
    const result = normalizeQuestionInput(rawQuestions[index], index + 1);

    if (!result.valid) {
      return res.json({
        success: false,
        message: result.message,
      });
    }

    normalizedQuestions.push(result.value);
  }

  try {
    await dbRun("BEGIN TRANSACTION");

    const insertQuiz = await dbRun(
      `
      INSERT INTO quizzes(title, category, question_count, uploaded_by)
      VALUES(?, ?, 0, ?)
      `,
      [title, category, userId],
    );

    for (const question of normalizedQuestions) {
      await dbRun(
        `
        INSERT INTO questions(
          quiz_id,
          question_text,
          option_a,
          option_b,
          option_c,
          option_d,
          correct_answer,
          question_order
        )
        VALUES(?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          insertQuiz.lastID,
          question.questionText,
          question.optionA,
          question.optionB,
          question.optionC,
          question.optionD,
          question.correctAnswer,
          question.questionOrder,
        ],
      );
    }

    await refreshQuizQuestionCount(insertQuiz.lastID);
    await dbRun("COMMIT");

    const quiz = await dbGet("SELECT * FROM quizzes WHERE id = ?", [
      insertQuiz.lastID,
    ]);

    res.json({
      success: true,
      quiz,
    });
  } catch (err) {
    await dbRun("ROLLBACK").catch(() => {});
    console.error(err);
    res.json({
      success: false,
      message: "Failed to create quiz",
    });
  }
});

app.post("/api/quizzes/:id/questions", async (req, res) => {
  const quizId = Number(req.params.id);

  if (!Number.isInteger(quizId) || quizId <= 0) {
    return res.json({
      success: false,
      message: "Invalid quiz id",
    });
  }

  const quiz = await dbGet("SELECT id FROM quizzes WHERE id = ?", [
    quizId,
  ]).catch((err) => {
    console.error(err);
    return null;
  });

  if (!quiz) {
    return res.json({
      success: false,
      message: "Quiz not found",
    });
  }

  const currentCountRow = await dbGet(
    "SELECT COUNT(*) AS count FROM questions WHERE quiz_id = ?",
    [quizId],
  ).catch((err) => {
    console.error(err);
    return null;
  });

  if (!currentCountRow) {
    return res.json({
      success: false,
      message: "Failed to load quiz questions",
    });
  }

  const result = normalizeQuestionInput(req.body, currentCountRow.count + 1);

  if (!result.valid) {
    return res.json({
      success: false,
      message: result.message,
    });
  }

  try {
    const insertQuestion = await dbRun(
      `
      INSERT INTO questions(
        quiz_id,
        question_text,
        option_a,
        option_b,
        option_c,
        option_d,
        correct_answer,
        question_order
      )
      VALUES(?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        quizId,
        result.value.questionText,
        result.value.optionA,
        result.value.optionB,
        result.value.optionC,
        result.value.optionD,
        result.value.correctAnswer,
        result.value.questionOrder,
      ],
    );

    await refreshQuizQuestionCount(quizId);

    const question = await dbGet("SELECT * FROM questions WHERE id = ?", [
      insertQuestion.lastID,
    ]);

    res.json({
      success: true,
      question,
    });
  } catch (err) {
    console.error(err);
    res.json({
      success: false,
      message: "Failed to add question",
    });
  }
});

app.post("/api/quiz-attempts", async (req, res) => {
  const quizId = Number(req.body.quizId);
  const userId = Number(req.body.userId);

  if (
    !Number.isInteger(quizId) ||
    quizId <= 0 ||
    !Number.isInteger(userId) ||
    userId <= 0
  ) {
    return res.json({
      success: false,
      message: "Valid quizId and userId are required",
    });
  }

  try {
    const quiz = await dbGet("SELECT id FROM quizzes WHERE id = ?", [quizId]);
    const user = await dbGet("SELECT id FROM users WHERE id = ?", [userId]);

    if (!quiz) {
      return res.json({
        success: false,
        message: "Quiz not found",
      });
    }

    if (!user) {
      return res.json({
        success: false,
        message: "User not found",
      });
    }

    const questionCountRow = await dbGet(
      "SELECT COUNT(*) AS count FROM questions WHERE quiz_id = ?",
      [quizId],
    );

    const insertAttempt = await dbRun(
      `
      INSERT INTO quiz_attempts(quiz_id, user_id, score, total_questions, status)
      VALUES(?, ?, 0, ?, 'in_progress')
      `,
      [quizId, userId, questionCountRow.count],
    );

    const attempt = await dbGet("SELECT * FROM quiz_attempts WHERE id = ?", [
      insertAttempt.lastID,
    ]);

    res.json({
      success: true,
      attempt,
    });
  } catch (err) {
    console.error(err);
    res.json({
      success: false,
      message: "Failed to create quiz attempt",
    });
  }
});

app.post("/api/quiz-attempts/:attemptId/answers", async (req, res) => {
  const attemptId = Number(req.params.attemptId);
  const questionId = Number(req.body.questionId);
  const selectedAnswer = normalizeAnswerChoice(req.body.selectedAnswer);

  if (
    !Number.isInteger(attemptId) ||
    attemptId <= 0 ||
    !Number.isInteger(questionId) ||
    questionId <= 0 ||
    !selectedAnswer
  ) {
    return res.json({
      success: false,
      message: "Valid attemptId, questionId, and selectedAnswer are required",
    });
  }

  try {
    const attempt = await dbGet(
      "SELECT id, quiz_id, status FROM quiz_attempts WHERE id = ?",
      [attemptId],
    );

    if (!attempt) {
      return res.json({
        success: false,
        message: "Quiz attempt not found",
      });
    }

    if (attempt.status !== "in_progress") {
      return res.json({
        success: false,
        message: "Quiz attempt is no longer active",
      });
    }

    const question = await dbGet(
      `
      SELECT id, quiz_id, correct_answer
      FROM questions
      WHERE id = ?
      `,
      [questionId],
    );

    if (!question || question.quiz_id !== attempt.quiz_id) {
      return res.json({
        success: false,
        message: "Question does not belong to this quiz attempt",
      });
    }

    const isCorrect = question.correct_answer === selectedAnswer ? 1 : 0;
    const existingAnswer = await dbGet(
      `
      SELECT id
      FROM quiz_answers
      WHERE attempt_id = ? AND question_id = ?
      `,
      [attemptId, questionId],
    );

    if (existingAnswer) {
      await dbRun(
        `
        UPDATE quiz_answers
        SET selected_answer = ?, is_correct = ?, answered_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
        [selectedAnswer, isCorrect, existingAnswer.id],
      );
    } else {
      await dbRun(
        `
        INSERT INTO quiz_answers(attempt_id, question_id, selected_answer, is_correct)
        VALUES(?, ?, ?, ?)
        `,
        [attemptId, questionId, selectedAnswer, isCorrect],
      );
    }

    res.json({
      success: true,
      answer: {
        attemptId,
        questionId,
        selectedAnswer,
        isCorrect,
      },
    });
  } catch (err) {
    console.error(err);
    res.json({
      success: false,
      message: "Failed to save answer",
    });
  }
});

app.put("/api/quiz-attempts/:attemptId/complete", async (req, res) => {
  const attemptId = Number(req.params.attemptId);

  if (!Number.isInteger(attemptId) || attemptId <= 0) {
    return res.json({
      success: false,
      message: "Invalid attempt id",
    });
  }

  try {
    const attempt = await dbGet(
      "SELECT id, quiz_id, status FROM quiz_attempts WHERE id = ?",
      [attemptId],
    );

    if (!attempt) {
      return res.json({
        success: false,
        message: "Quiz attempt not found",
      });
    }

    const scoreRow = await dbGet(
      `
      SELECT
        COUNT(*) AS answered_count,
        COALESCE(SUM(is_correct), 0) AS score
      FROM quiz_answers
      WHERE attempt_id = ?
      `,
      [attemptId],
    );

    const totalQuestionsRow = await dbGet(
      "SELECT COUNT(*) AS count FROM questions WHERE quiz_id = ?",
      [attempt.quiz_id],
    );

    await dbRun(
      `
      UPDATE quiz_attempts
      SET score = ?, total_questions = ?, status = 'completed', completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [scoreRow.score, totalQuestionsRow.count, attemptId],
    );

    const updatedAttempt = await dbGet(
      "SELECT * FROM quiz_attempts WHERE id = ?",
      [attemptId],
    );

    res.json({
      success: true,
      attempt: updatedAttempt,
      answeredCount: scoreRow.answered_count,
    });
  } catch (err) {
    console.error(err);
    res.json({
      success: false,
      message: "Failed to complete quiz attempt",
    });
  }
});

app.get("/api/quiz-attempts/:attemptId", async (req, res) => {
  const attemptId = Number(req.params.attemptId);

  if (!Number.isInteger(attemptId) || attemptId <= 0) {
    return res.json({
      success: false,
      message: "Invalid attempt id",
    });
  }

  try {
    const attempt = await dbGet(
      `
      SELECT
        quiz_attempts.*,
        quizzes.title AS quiz_title,
        quizzes.category AS quiz_category,
        users.username
      FROM quiz_attempts
      LEFT JOIN quizzes
        ON quiz_attempts.quiz_id = quizzes.id
      LEFT JOIN users
        ON quiz_attempts.user_id = users.id
      WHERE quiz_attempts.id = ?
      `,
      [attemptId],
    );

    if (!attempt) {
      return res.json({
        success: false,
        message: "Quiz attempt not found",
      });
    }

    const answers = await dbAll(
      `
      SELECT
        quiz_answers.id,
        quiz_answers.attempt_id,
        quiz_answers.question_id,
        quiz_answers.selected_answer,
        quiz_answers.is_correct,
        quiz_answers.answered_at,
        questions.question_text,
        questions.correct_answer,
        questions.question_order
      FROM quiz_answers
      LEFT JOIN questions
        ON quiz_answers.question_id = questions.id
      WHERE quiz_answers.attempt_id = ?
      ORDER BY questions.question_order ASC, quiz_answers.id ASC
      `,
      [attemptId],
    );

    res.json({
      success: true,
      attempt,
      answers,
    });
  } catch (err) {
    console.error(err);
    res.json({ success: false });
  }
});

app.get("/api/quiz/:id", async (req, res) => {
  try {
    const quiz = await getQuizById(req.params.id);

    if (!quiz) {
      return res.json({
        success: false,
        message: "Quiz not found",
      });
    }

    const questions = await getQuestionsWithOptions(req.params.id);

    res.json({
      success: true,
      quiz,
      questions: questions.map((question) => ({
        id: question.id,
        quiz_id: question.quiz_id,
        question_text: question.question_text,
        question_order: question.question_order,
        options: question.options.map((option) => ({
          id: option.id,
          question_id: option.question_id,
          option_text: option.option_text,
        })),
      })),
    });
  } catch (err) {
    console.error(err);
    res.json({
      success: false,
      message: "Failed to load quiz",
    });
  }
});

app.post("/api/create-quiz", async (req, res) => {
  const title = toOptionalText(req.body.title);
  const description = toOptionalText(req.body.description);
  const category = toOptionalText(req.body.category);
  const orderMode = ["ordered", "random"].includes(req.body.orderMode)
    ? req.body.orderMode
    : "ordered";
  const timerEnabled =
    Number(req.body.timerEnabled) === 1 || req.body.timerEnabled === true;
  const createdBy = Number(req.body.createdBy || req.body.userId);
  const rawQuestions = Array.isArray(req.body.questions)
    ? req.body.questions
    : [];

  if (!title || !category || !Number.isInteger(createdBy) || createdBy <= 0) {
    return res.json({
      success: false,
      message: "title, category, and valid createdBy are required",
    });
  }

  if (rawQuestions.length === 0) {
    return res.json({
      success: false,
      message: "A quiz must include at least 1 question",
    });
  }

  try {
    const user = await dbGet("SELECT id FROM users WHERE id = ?", [createdBy]);

    if (!user) {
      return res.json({
        success: false,
        message: "Creator not found",
      });
    }

    const questions = [];

    for (let index = 0; index < rawQuestions.length; index += 1) {
      const normalized = normalizeStructuredQuestion(
        rawQuestions[index],
        index + 1,
      );

      if (!normalized.valid) {
        return res.json({
          success: false,
          message: normalized.message,
        });
      }

      questions.push(normalized.value);
    }

    if (hasDuplicateQuestionOrders(questions)) {
      return res.json({
        success: false,
        message: "Each question order must be unique",
      });
    }

    await dbRun("BEGIN TRANSACTION");

    const insertQuiz = await dbRun(
      `
      INSERT INTO quizzes(
        title,
        description,
        category,
        timer_enabled,
        order_mode,
        question_count,
        uploaded_by,
        created_by
      )
      VALUES(?, ?, ?, ?, ?, 0, ?, ?)
      `,
      [
        title,
        description,
        category,
        timerEnabled ? 1 : 0,
        orderMode,
        createdBy,
        createdBy,
      ],
    );

    for (const question of questions) {
      await createQuestionRecord(insertQuiz.lastID, question);
    }

    await refreshQuizQuestionCount(insertQuiz.lastID);
    await dbRun("COMMIT");

    const quiz = await getQuizById(insertQuiz.lastID);
    const quizQuestions = await getQuestionsWithOptions(insertQuiz.lastID);

    res.json({
      success: true,
      message: "Quiz created successfully",
      quiz,
      questions: quizQuestions,
    });
  } catch (err) {
    await dbRun("ROLLBACK").catch(() => {});
    console.error(err);
    res.json({
      success: false,
      message: "Failed to create quiz",
    });
  }
});

app.post("/api/add-question", async (req, res) => {
  const quizId = Number(req.body.quizId);

  if (!Number.isInteger(quizId) || quizId <= 0) {
    return res.json({
      success: false,
      message: "A valid quizId is required",
    });
  }

  try {
    const quiz = await dbGet("SELECT id FROM quizzes WHERE id = ?", [quizId]);

    if (!quiz) {
      return res.json({
        success: false,
        message: "Quiz not found",
      });
    }

    const questionCountRow = await dbGet(
      "SELECT COUNT(*) AS count FROM questions WHERE quiz_id = ?",
      [quizId],
    );
    const normalized = normalizeStructuredQuestion(
      req.body,
      questionCountRow.count + 1,
    );

    if (!normalized.valid) {
      return res.json({
        success: false,
        message: normalized.message,
      });
    }

    const existingOrder = await dbGet(
      "SELECT id FROM questions WHERE quiz_id = ? AND question_order = ?",
      [quizId, normalized.value.questionOrder],
    );

    if (existingOrder) {
      return res.json({
        success: false,
        message: "Question order already exists for this quiz",
      });
    }

    const questionId = await createQuestionRecord(quizId, normalized.value);
    await refreshQuizQuestionCount(quizId);

    const question = (await getQuestionsWithOptions(quizId)).find(
      (item) => Number(item.id) === Number(questionId),
    );

    res.json({
      success: true,
      message: "Question added successfully",
      question,
    });
  } catch (err) {
    console.error(err);
    res.json({
      success: false,
      message: "Failed to add question",
    });
  }
});

app.post("/api/start-quiz", async (req, res) => {
  const quizId = Number(req.body.quizId);
  const userId = Number(req.body.userId);

  if (
    !Number.isInteger(quizId) ||
    quizId <= 0 ||
    !Number.isInteger(userId) ||
    userId <= 0
  ) {
    return res.json({
      success: false,
      message: "Valid quizId and userId are required",
    });
  }

  try {
    const quiz = await getQuizById(quizId);
    const user = await dbGet("SELECT id, username FROM users WHERE id = ?", [
      userId,
    ]);

    if (!quiz) {
      return res.json({
        success: false,
        message: "Quiz not found",
      });
    }

    if (!user) {
      return res.json({
        success: false,
        message: "User not found",
      });
    }

    const questions = await getQuestionsWithOptions(quizId);
    const orderedQuestions =
      quiz.order_mode === "random" ? shuffleArray(questions) : questions;

    if (orderedQuestions.length === 0) {
      return res.json({
        success: false,
        message: "Quiz has no questions yet",
      });
    }

    const insertAttempt = await dbRun(
      `
      INSERT INTO quiz_attempts(
        quiz_id,
        user_id,
        score,
        total_questions,
        status,
        started_at
      )
      VALUES(?, ?, 0, ?, 'in_progress', CURRENT_TIMESTAMP)
      `,
      [quizId, userId, orderedQuestions.length],
    );

    const attempt = await dbGet("SELECT * FROM quiz_attempts WHERE id = ?", [
      insertAttempt.lastID,
    ]);

    res.json({
      success: true,
      message: "Quiz started",
      attempt,
      quiz,
      questions: orderedQuestions.map((question) => ({
        id: question.id,
        quiz_id: question.quiz_id,
        question_text: question.question_text,
        question_order: question.question_order,
        options: question.options.map((option) => ({
          id: option.id,
          question_id: option.question_id,
          option_text: option.option_text,
        })),
      })),
    });
  } catch (err) {
    console.error(err);
    res.json({
      success: false,
      message: "Failed to start quiz",
    });
  }
});

app.post("/api/submit-answer", async (req, res) => {
  const attemptId = Number(req.body.attemptId);
  const questionId = Number(req.body.questionId);
  const selectedOptionId = Number(req.body.selectedOptionId);

  if (
    !Number.isInteger(attemptId) ||
    attemptId <= 0 ||
    !Number.isInteger(questionId) ||
    questionId <= 0 ||
    !Number.isInteger(selectedOptionId) ||
    selectedOptionId <= 0
  ) {
    return res.json({
      success: false,
      message: "attemptId, questionId, and selectedOptionId are required",
    });
  }

  try {
    const attempt = await dbGet(
      "SELECT id, quiz_id, status FROM quiz_attempts WHERE id = ?",
      [attemptId],
    );

    if (!attempt) {
      return res.json({
        success: false,
        message: "Quiz attempt not found",
      });
    }

    if (attempt.status !== "in_progress") {
      return res.json({
        success: false,
        message: "Quiz attempt is already finished",
      });
    }

    const question = await dbGet(
      "SELECT id, quiz_id FROM questions WHERE id = ?",
      [questionId],
    );

    if (!question || Number(question.quiz_id) !== Number(attempt.quiz_id)) {
      return res.json({
        success: false,
        message: "Question does not belong to this quiz",
      });
    }

    const selectedOption = await dbGet(
      `
      SELECT id, question_id, is_correct
      FROM question_options
      WHERE id = ?
      `,
      [selectedOptionId],
    );

    if (
      !selectedOption ||
      Number(selectedOption.question_id) !== Number(questionId)
    ) {
      return res.json({
        success: false,
        message: "Selected option does not belong to this question",
      });
    }

    const isCorrect = Number(selectedOption.is_correct) === 1 ? 1 : 0;
    const existingAnswer = await dbGet(
      `
      SELECT id
      FROM user_answers
      WHERE attempt_id = ? AND question_id = ?
      `,
      [attemptId, questionId],
    );

    if (existingAnswer) {
      await dbRun(
        `
        UPDATE user_answers
        SET selected_option_id = ?, is_correct = ?
        WHERE id = ?
        `,
        [selectedOptionId, isCorrect, existingAnswer.id],
      );
    } else {
      await dbRun(
        `
        INSERT INTO user_answers(attempt_id, question_id, selected_option_id, is_correct)
        VALUES(?, ?, ?, ?)
        `,
        [attemptId, questionId, selectedOptionId, isCorrect],
      );
    }

    const progress = await dbGet(
      `
      SELECT COUNT(*) AS answered
      FROM user_answers
      WHERE attempt_id = ?
      `,
      [attemptId],
    );

    res.json({
      success: true,
      message: "Answer saved",
      answer: {
        attemptId,
        questionId,
        selectedOptionId,
        isCorrect,
      },
      progress,
    });
  } catch (err) {
    console.error(err);
    res.json({
      success: false,
      message: "Failed to submit answer",
    });
  }
});

app.post("/api/finish-quiz", async (req, res) => {
  const attemptId = Number(req.body.attemptId);

  if (!Number.isInteger(attemptId) || attemptId <= 0) {
    return res.json({
      success: false,
      message: "A valid attemptId is required",
    });
  }

  try {
    const attempt = await dbGet(
      "SELECT id, quiz_id, user_id FROM quiz_attempts WHERE id = ?",
      [attemptId],
    );

    if (!attempt) {
      return res.json({
        success: false,
        message: "Quiz attempt not found",
      });
    }

    const scoreRow = await dbGet(
      `
      SELECT
        COUNT(*) AS answered_count,
        COALESCE(SUM(is_correct), 0) AS score
      FROM user_answers
      WHERE attempt_id = ?
      `,
      [attemptId],
    );

    const totalRow = await dbGet(
      "SELECT COUNT(*) AS total_questions FROM questions WHERE quiz_id = ?",
      [attempt.quiz_id],
    );

    await dbRun(
      `
      UPDATE quiz_attempts
      SET
        score = ?,
        total_questions = ?,
        status = 'completed',
        completed_at = CURRENT_TIMESTAMP,
        finished_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [scoreRow.score, totalRow.total_questions, attemptId],
    );

    const updatedAttempt = await dbGet(
      `
      SELECT
        quiz_attempts.*,
        quizzes.title AS quiz_title,
        quizzes.category AS quiz_category,
        users.username
      FROM quiz_attempts
      LEFT JOIN quizzes
        ON quiz_attempts.quiz_id = quizzes.id
      LEFT JOIN users
        ON quiz_attempts.user_id = users.id
      WHERE quiz_attempts.id = ?
      `,
      [attemptId],
    );

    const percentage =
      updatedAttempt.total_questions > 0
        ? Math.round(
            (updatedAttempt.score / updatedAttempt.total_questions) * 100,
          )
        : 0;
    const timeTaken = formatDuration(
      updatedAttempt.started_at,
      updatedAttempt.finished_at || updatedAttempt.completed_at,
    );

    res.json({
      success: true,
      message: "Quiz finished",
      attempt: updatedAttempt,
      result: {
        score: updatedAttempt.score,
        totalQuestions: updatedAttempt.total_questions,
        correctAnswers: updatedAttempt.score,
        answeredQuestions: scoreRow.answered_count,
        percentage,
        timeTaken,
      },
    });
  } catch (err) {
    console.error(err);
    res.json({
      success: false,
      message: "Failed to finish quiz",
    });
  }
});

app.get("/api/quiz-leaderboard/:quizId", async (req, res) => {
  const quizId = Number(req.params.quizId);

  if (!Number.isInteger(quizId) || quizId <= 0) {
    return res.json({
      success: false,
      message: "Invalid quiz id",
    });
  }

  try {
    const leaderboard = await dbAll(
      `
      SELECT
        ranked.username,
        ranked.score,
        ranked.total_questions,
        ranked.finished_at,
        ranked.percentage
      FROM (
        SELECT
          users.username,
          quiz_attempts.user_id,
          quiz_attempts.score,
          quiz_attempts.total_questions,
          quiz_attempts.finished_at,
          ROUND(
            CASE
              WHEN quiz_attempts.total_questions > 0
              THEN (quiz_attempts.score * 100.0) / quiz_attempts.total_questions
              ELSE 0
            END,
            0
          ) AS percentage,
          ROW_NUMBER() OVER (
            PARTITION BY quiz_attempts.user_id
            ORDER BY
              quiz_attempts.score DESC,
              CASE
                WHEN quiz_attempts.total_questions > 0
                THEN (quiz_attempts.score * 1.0) / quiz_attempts.total_questions
                ELSE 0
              END DESC,
              quiz_attempts.finished_at ASC,
              quiz_attempts.id ASC
          ) AS user_rank
        FROM quiz_attempts
        LEFT JOIN users
          ON quiz_attempts.user_id = users.id
        WHERE quiz_attempts.quiz_id = ?
          AND quiz_attempts.status = 'completed'
      ) ranked
      WHERE ranked.user_rank = 1
      ORDER BY ranked.score DESC, ranked.percentage DESC, ranked.finished_at ASC
      LIMIT 20
      `,
      [quizId],
    );

    res.json({
      success: true,
      leaderboard: leaderboard.map((entry, index) => ({
        rank: index + 1,
        ...entry,
      })),
    });
  } catch (err) {
    console.error(err);
    res.json({
      success: false,
      message: "Failed to load leaderboard",
    });
  }
});

initializeBaseSchema()
  .then(() => initializeQuizSchema())
  .then(() => {
    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize quiz schema:", err);
    process.exit(1);
  });
