CREATE TABLE IF NOT EXISTS borrow_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  post_id INT NOT NULL,
  owner_id INT NOT NULL,
  borrower_id INT NOT NULL,
  status ENUM('pending', 'approved', 'declined') NOT NULL DEFAULT 'pending',
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_borrow_requests_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_borrow_requests_owner FOREIGN KEY (owner_id) REFERENCES register(id) ON DELETE CASCADE,
  CONSTRAINT fk_borrow_requests_borrower FOREIGN KEY (borrower_id) REFERENCES register(id) ON DELETE CASCADE
);

CREATE INDEX idx_borrow_requests_owner_status ON borrow_requests(owner_id, status);
CREATE INDEX idx_borrow_requests_borrower_status ON borrow_requests(borrower_id, status);
CREATE INDEX idx_borrow_requests_post_status ON borrow_requests(post_id, status);

CREATE TABLE IF NOT EXISTS borrow_notifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  request_id INT NOT NULL,
  recipient_id INT NOT NULL,
  actor_id INT NOT NULL,
  type ENUM('incoming-request', 'request-approved', 'request-declined') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_borrow_notifications_request FOREIGN KEY (request_id) REFERENCES borrow_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_borrow_notifications_recipient FOREIGN KEY (recipient_id) REFERENCES register(id) ON DELETE CASCADE,
  CONSTRAINT fk_borrow_notifications_actor FOREIGN KEY (actor_id) REFERENCES register(id) ON DELETE CASCADE
);

CREATE INDEX idx_borrow_notifications_recipient_created ON borrow_notifications(recipient_id, created_at);
CREATE TABLE IF NOT EXISTS system_notifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  post_id INT NULL,
  recipient_id INT NOT NULL,
  actor_id INT NOT NULL,
  type ENUM('post-deleted') NOT NULL,
  message TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_system_notifications_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE SET NULL,
  CONSTRAINT fk_system_notifications_recipient FOREIGN KEY (recipient_id) REFERENCES register(id) ON DELETE CASCADE,
  CONSTRAINT fk_system_notifications_actor FOREIGN KEY (actor_id) REFERENCES register(id) ON DELETE CASCADE
);

CREATE INDEX idx_system_notifications_recipient_created ON system_notifications(recipient_id, created_at);
