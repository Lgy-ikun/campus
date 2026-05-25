CREATE DATABASE IF NOT EXISTS campus_service
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE campus_service;

DROP TABLE IF EXISTS repair_order;
DROP TABLE IF EXISTS repair_worker;

CREATE TABLE IF NOT EXISTS admin (
  admin_id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  real_name VARCHAR(50) DEFAULT '',
  phone VARCHAR(20) DEFAULT '',
  status TINYINT DEFAULT 1,
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `user` (
  user_id INT PRIMARY KEY AUTO_INCREMENT,
  openid VARCHAR(100) NOT NULL UNIQUE,
  student_id VARCHAR(50) DEFAULT NULL UNIQUE,
  nickname VARCHAR(50) NOT NULL,
  avatar VARCHAR(255) DEFAULT '',
  phone VARCHAR(20) DEFAULT '',
  password VARCHAR(255) DEFAULT '',
  status TINYINT DEFAULT 1,
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_status (status),
  INDEX idx_user_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS idle_goods (
  goods_id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  title VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  description TEXT,
  images TEXT NOT NULL,
  contact_info VARCHAR(100) NOT NULL,
  trade_address VARCHAR(255) NOT NULL DEFAULT '',
  trade_latitude DECIMAL(10, 6) DEFAULT NULL,
  trade_longitude DECIMAL(10, 6) DEFAULT NULL,
  status TINYINT DEFAULT 0,
  reject_reason VARCHAR(255) DEFAULT '',
  browse_count INT DEFAULT 0,
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_idle_user FOREIGN KEY (user_id) REFERENCES `user` (user_id),
  INDEX idx_idle_status (status),
  INDEX idx_idle_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS errand_order (
  order_id INT PRIMARY KEY AUTO_INCREMENT,
  publisher_id INT NOT NULL,
  receiver_id INT DEFAULT NULL,
  title VARCHAR(100) NOT NULL,
  description TEXT,
  pick_address VARCHAR(255) NOT NULL,
  pick_latitude DECIMAL(10, 6) NOT NULL,
  pick_longitude DECIMAL(10, 6) NOT NULL,
  deliver_address VARCHAR(255) NOT NULL,
  deliver_latitude DECIMAL(10, 6) NOT NULL,
  deliver_longitude DECIMAL(10, 6) NOT NULL,
  reward DECIMAL(10, 2) NOT NULL,
  images TEXT,
  contact_info VARCHAR(100) NOT NULL,
  expect_time VARCHAR(100) NOT NULL DEFAULT '',
  status TINYINT DEFAULT 0,
  reject_reason VARCHAR(255) DEFAULT '',
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  finish_time DATETIME DEFAULT NULL,
  CONSTRAINT fk_errand_publisher FOREIGN KEY (publisher_id) REFERENCES `user` (user_id),
  CONSTRAINT fk_errand_receiver FOREIGN KEY (receiver_id) REFERENCES `user` (user_id),
  INDEX idx_errand_status (status),
  INDEX idx_errand_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS chat_message (
  message_id INT PRIMARY KEY AUTO_INCREMENT,
  sender_id INT NOT NULL,
  sender_type TINYINT NOT NULL,
  receiver_id INT NOT NULL,
  receiver_type TINYINT NOT NULL,
  content TEXT NOT NULL,
  message_type TINYINT DEFAULT 1,
  is_read TINYINT DEFAULT 0,
  related_type VARCHAR(20) DEFAULT '',
  related_id INT DEFAULT NULL,
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_chat_receiver (receiver_id, receiver_type, is_read),
  INDEX idx_chat_related (related_type, related_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS chat_session_preference (
  preference_id INT PRIMARY KEY AUTO_INCREMENT,
  owner_id INT NOT NULL,
  owner_type TINYINT NOT NULL,
  partner_id INT NOT NULL,
  partner_type TINYINT NOT NULL,
  related_type VARCHAR(20) NOT NULL DEFAULT '',
  related_id INT NOT NULL DEFAULT 0,
  is_pinned TINYINT NOT NULL DEFAULT 0,
  hidden_before_message_id INT NOT NULL DEFAULT 0,
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_chat_session_preference (owner_id, owner_type, partner_id, partner_type, related_type, related_id),
  INDEX idx_chat_session_owner (owner_id, owner_type, is_pinned)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS system_notice (
  notice_id INT PRIMARY KEY AUTO_INCREMENT,
  receiver_id INT NOT NULL,
  receiver_role VARCHAR(20) NOT NULL DEFAULT 'user',
  title VARCHAR(100) NOT NULL,
  content VARCHAR(500) NOT NULL,
  notice_type VARCHAR(30) NOT NULL DEFAULT 'system',
  related_type VARCHAR(20) NOT NULL DEFAULT '',
  related_id INT NOT NULL DEFAULT 0,
  extra_json TEXT,
  is_read TINYINT NOT NULL DEFAULT 0,
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  read_time DATETIME DEFAULT NULL,
  INDEX idx_notice_receiver (receiver_id, receiver_role, is_read, create_time),
  INDEX idx_notice_related (related_type, related_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_log (
  audit_id INT PRIMARY KEY AUTO_INCREMENT,
  admin_id INT NOT NULL,
  business_type VARCHAR(20) NOT NULL,
  business_id INT NOT NULL,
  audit_result TINYINT NOT NULL,
  audit_reason VARCHAR(255) DEFAULT '',
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_admin FOREIGN KEY (admin_id) REFERENCES admin (admin_id),
  INDEX idx_audit_business (business_type, business_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS login_sms_code (
  sms_id INT PRIMARY KEY AUTO_INCREMENT,
  phone VARCHAR(20) NOT NULL,
  scene VARCHAR(20) NOT NULL DEFAULT 'login',
  code VARCHAR(10) NOT NULL,
  expire_time DATETIME NOT NULL,
  is_used TINYINT NOT NULL DEFAULT 0,
  used_time DATETIME DEFAULT NULL,
  send_channel VARCHAR(30) NOT NULL DEFAULT 'mock',
  send_result TEXT,
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sms_phone_scene (phone, scene, is_used, expire_time),
  INDEX idx_sms_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS content_report (
  report_id INT PRIMARY KEY AUTO_INCREMENT,
  business_type VARCHAR(20) NOT NULL,
  business_id INT NOT NULL,
  report_count INT NOT NULL DEFAULT 1,
  latest_reason VARCHAR(255) NOT NULL DEFAULT '',
  latest_reporter_id INT DEFAULT NULL,
  latest_report_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_handled TINYINT NOT NULL DEFAULT 0,
  handle_admin_id INT DEFAULT NULL,
  handle_note VARCHAR(255) NOT NULL DEFAULT '',
  handle_time DATETIME DEFAULT NULL,
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_report_business (business_type, business_id),
  INDEX idx_report_state (is_handled, latest_report_time),
  INDEX idx_report_business (business_type, business_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS system_setting (
  setting_key VARCHAR(50) PRIMARY KEY,
  setting_value VARCHAR(100) NOT NULL,
  setting_desc VARCHAR(255) NOT NULL DEFAULT '',
  update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO system_setting (setting_key, setting_value, setting_desc)
VALUES
  ('upload_max_size_mb', '5', '单张图片最大上传大小，单位 MB，0 表示不限制'),
  ('idle_max_images', '20', '闲置物品最多上传图片数量'),
  ('errand_max_images', '20', '代拿订单最多上传图片数量')
ON DUPLICATE KEY UPDATE setting_key = setting_key;

ALTER TABLE idle_goods
  MODIFY contact_info VARCHAR(100) NOT NULL DEFAULT '';

ALTER TABLE idle_goods
  ADD COLUMN trade_address VARCHAR(255) NOT NULL DEFAULT '' AFTER contact_info;

ALTER TABLE idle_goods
  ADD COLUMN trade_latitude DECIMAL(10, 6) DEFAULT NULL AFTER trade_address;

ALTER TABLE idle_goods
  ADD COLUMN trade_longitude DECIMAL(10, 6) DEFAULT NULL AFTER trade_latitude;

ALTER TABLE errand_order
  MODIFY contact_info VARCHAR(100) NOT NULL DEFAULT '';

ALTER TABLE errand_order
  MODIFY expect_time VARCHAR(100) NULL DEFAULT NULL;

UPDATE errand_order
  SET expect_time = ''
  WHERE expect_time IS NULL;

ALTER TABLE errand_order
  MODIFY expect_time VARCHAR(100) NOT NULL DEFAULT '';


DELETE FROM chat_session_preference
WHERE owner_type = 2 OR partner_type = 2;

DELETE FROM chat_message
WHERE sender_type = 2 OR receiver_type = 2;

DELETE FROM system_notice
WHERE receiver_role = 'worker';
