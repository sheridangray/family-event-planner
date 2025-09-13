-- Migration: Create unified notifications system
-- This replaces the awkward sms_approvals table with a proper notifications table

-- Create the new notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(255) REFERENCES events(id) ON DELETE CASCADE,
    notification_type VARCHAR(20) NOT NULL CHECK (notification_type IN ('sms', 'email')),
    recipient VARCHAR(255) NOT NULL, -- phone number or email address
    subject VARCHAR(500), -- for emails, null for SMS
    message_content TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'sent' CHECK (status IN ('sent', 'pending', 'delivered', 'failed', 'approved', 'rejected', 'unclear', 'cancelled')),
    
    -- Response tracking
    response_received TEXT,
    response_at TIMESTAMP,
    response_status VARCHAR(50), -- approved, rejected, unclear, cancelled
    
    -- Metadata
    message_id VARCHAR(255), -- Gmail Message-ID or Twilio SID
    confirmation_number VARCHAR(255), -- for tracking replies
    retry_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_notifications_event_id ON notifications(event_id);
CREATE INDEX idx_notifications_recipient ON notifications(recipient);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_type ON notifications(notification_type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER trigger_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_notifications_updated_at();

-- Migrate existing data from sms_approvals to notifications
INSERT INTO notifications (
    event_id,
    notification_type,
    recipient,
    subject,
    message_content,
    status,
    response_received,
    response_at,
    message_id,
    created_at,
    sent_at
)
SELECT 
    event_id,
    CASE 
        WHEN phone_number LIKE '%@%' THEN 'email'
        ELSE 'sms'
    END as notification_type,
    phone_number as recipient,
    CASE 
        WHEN phone_number LIKE '%@%' THEN 'Family Event Notification'
        ELSE NULL
    END as subject,
    CASE 
        WHEN message_sent LIKE '{"messageId"%' THEN 
            -- Extract original body from JSON for emails
            COALESCE(
                (message_sent::json->>'originalBody'),
                message_sent
            )
        ELSE message_sent
    END as message_content,
    COALESCE(status, 'sent') as status,
    response_received,
    response_at,
    CASE 
        WHEN message_sent LIKE '{"messageId"%' THEN 
            -- Extract Gmail Message-ID from JSON for emails
            (message_sent::json->>'messageId')
        ELSE NULL
    END as message_id,
    created_at,
    created_at as sent_at
FROM sms_approvals
WHERE event_id IS NOT NULL;

-- Add comment explaining the table
COMMENT ON TABLE notifications IS 'Unified table for tracking all family event notifications (SMS and Email)';
COMMENT ON COLUMN notifications.notification_type IS 'Type of notification: sms or email';
COMMENT ON COLUMN notifications.recipient IS 'Phone number for SMS or email address for email notifications';
COMMENT ON COLUMN notifications.message_id IS 'Gmail Message-ID for emails or Twilio SID for SMS';
COMMENT ON COLUMN notifications.confirmation_number IS 'Unique identifier for tracking user responses';