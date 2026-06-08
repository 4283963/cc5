CREATE DATABASE IF NOT EXISTS cyber_hack CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE cyber_hack;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  player_id VARCHAR(64) NOT NULL UNIQUE,
  display_name VARCHAR(32) DEFAULT NULL,
  coins INT NOT NULL DEFAULT 0,
  total_score INT NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_player_id (player_id),
  INDEX idx_total_score (total_score DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS level_progress (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  level_id INT NOT NULL,
  stars INT NOT NULL DEFAULT 0,
  best_latency INT DEFAULT NULL,
  best_time INT DEFAULT NULL,
  coins_earned INT NOT NULL DEFAULT 0,
  level_score INT NOT NULL DEFAULT 0,
  unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME DEFAULT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_user_level (user_id, level_id),
  INDEX idx_user_id (user_id),
  INDEX idx_level_id (level_id),
  INDEX idx_level_score (level_id, level_score DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS leaderboard (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  player_id VARCHAR(64) NOT NULL,
  display_name VARCHAR(32) DEFAULT NULL,
  total_score INT NOT NULL DEFAULT 0,
  total_stars INT NOT NULL DEFAULT 0,
  levels_completed INT NOT NULL DEFAULT 0,
  best_total_time INT DEFAULT NULL,
  rank INT DEFAULT NULL,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_user (user_id),
  UNIQUE KEY uk_player_id (player_id),
  INDEX idx_total_score (total_score DESC),
  INDEX idx_rank (rank)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO users (player_id, coins, total_score) VALUES ('demo_player', 500, 0);
