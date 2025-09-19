-- Order Management System Database Schema
-- Drop existing tables if they exist
DROP TABLE IF EXISTS bot_stats CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS evidence_files CASCADE;
DROP TABLE IF EXISTS order_progress_logs CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table with role-based access
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('HD', 'TEKNISI')),
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders table
CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    
    -- Customer Information
    customer_name VARCHAR(255) NOT NULL,
    customer_address TEXT NOT NULL,
    customer_contact VARCHAR(50) NOT NULL,
    
    -- Service Information
    sto VARCHAR(10) NOT NULL CHECK (sto IN ('CBB', 'CWA', 'GAN', 'JTN', 'KLD', 'KRG', 'PDK', 'PGB', 'PGG', 'PSR', 'RMG', 'BIN', 'CPE', 'JAG', 'KAL', 'KBY', 'KMG', 'PSM', 'TBE', 'NAS')),
    transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN ('Disconnect', 'Modify', 'New Install Existing', 'New Install JT', 'New Install', 'PDA')),
    service_type VARCHAR(30) NOT NULL CHECK (service_type IN ('Astinet', 'Metro', 'VPN IP', 'IP Transit', 'SIP Trunk')),
    
    -- Assignment
    created_by_hd_id BIGINT NOT NULL REFERENCES users(id),
    assigned_technician_id BIGINT REFERENCES users(id),
    
    -- Timing
    sod_time TIMESTAMP WITH TIME ZONE, -- Start of Delivery
    e2e_time TIMESTAMP WITH TIME ZONE, -- End to End
    lme_pt2_start TIMESTAMP WITH TIME ZONE, -- LME PT2 start time
    lme_pt2_end TIMESTAMP WITH TIME ZONE, -- LME PT2 end time
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'ON_HOLD', 'CLOSED', 'CANCELLED')),
    current_stage VARCHAR(30) DEFAULT 'SURVEY' CHECK (current_stage IN ('SURVEY', 'PENARIKAN_KABEL', 'INSTALASI_ONT', 'EVIDENCE_UPLOAD', 'COMPLETED')),
    
    -- SLA Tracking
    tti_comply BOOLEAN DEFAULT NULL, -- TTI comply 3x24 jam
    sla_deadline TIMESTAMP WITH TIME ZONE,
    
    -- Evidence Status
    evidence_complete BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE
);

-- Progress tracking table with individual columns for each stage
CREATE TABLE order_progress (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE UNIQUE,
    
    -- Survey stage
    survey_status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, COMPLETED, ON_HOLD
    survey_started_at TIMESTAMP WITH TIME ZONE,
    survey_completed_at TIMESTAMP WITH TIME ZONE,
    survey_notes TEXT,
    survey_updated_by INTEGER REFERENCES users(id),
    
    -- Penarikan Kabel stage
    penarikan_kabel_status VARCHAR(20) DEFAULT 'PENDING',
    penarikan_kabel_started_at TIMESTAMP WITH TIME ZONE,
    penarikan_kabel_completed_at TIMESTAMP WITH TIME ZONE,
    penarikan_kabel_notes TEXT,
    penarikan_kabel_updated_by INTEGER REFERENCES users(id),
    
    -- Instalasi ONT stage
    instalasi_ont_status VARCHAR(20) DEFAULT 'PENDING',
    instalasi_ont_started_at TIMESTAMP WITH TIME ZONE,
    instalasi_ont_completed_at TIMESTAMP WITH TIME ZONE,
    instalasi_ont_notes TEXT,
    instalasi_ont_updated_by INTEGER REFERENCES users(id),
    
    -- Evidence Upload stage
    evidence_upload_status VARCHAR(20) DEFAULT 'PENDING',
    evidence_upload_started_at TIMESTAMP WITH TIME ZONE,
    evidence_upload_completed_at TIMESTAMP WITH TIME ZONE,
    evidence_upload_notes TEXT,
    evidence_upload_updated_by INTEGER REFERENCES users(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Evidence Files table
CREATE TABLE evidence_files (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    evidence_type VARCHAR(30) NOT NULL CHECK (evidence_type IN (
        'NAMA_ODP', 'SN_ONT', 'FOTO_SN_ONT', 'FOTO_TEKNISI_PELANGGAN', 
        'FOTO_RUMAH_PELANGGAN', 'FOTO_DEPAN_ODP', 'FOTO_DALAM_ODP', 
        'FOTO_LABEL_DC', 'FOTO_TEST_REDAMAN'
    )),
    file_url VARCHAR(500), -- Supabase Storage URL
    file_name VARCHAR(255),
    text_value TEXT, -- For text-based evidence like NAMA_ODP, SN_ONT
    uploaded_by_user_id BIGINT NOT NULL REFERENCES users(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table for bot interaction history
CREATE TABLE messages (
    id BIGSERIAL PRIMARY KEY,
    telegram_id BIGINT NOT NULL,
    username VARCHAR(255),
    message TEXT NOT NULL,
    response TEXT,
    order_id BIGINT REFERENCES orders(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bot Stats table
CREATE TABLE bot_stats (
    id BIGSERIAL PRIMARY KEY,
    total_messages INTEGER DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    active_orders INTEGER DEFAULT 0,
    completed_orders INTEGER DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_assigned_technician ON orders(assigned_technician_id);
CREATE INDEX idx_orders_created_by ON orders(created_by_hd_id);
CREATE INDEX idx_orders_sto ON orders(sto);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_order_progress_order_id ON order_progress(order_id);
CREATE INDEX idx_evidence_files_order_id ON evidence_files(order_id);
CREATE INDEX idx_messages_order_id ON messages(order_id);
CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_users_role ON users(role);

-- Function to initialize progress tracking for new orders
CREATE OR REPLACE FUNCTION initialize_order_progress()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO order_progress (order_id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-initialize progress when order is created
CREATE TRIGGER trigger_initialize_progress
    AFTER INSERT ON orders
    FOR EACH ROW
    EXECUTE FUNCTION initialize_order_progress();

-- Function to update order status based on progress
CREATE OR REPLACE FUNCTION update_order_status_from_progress()
RETURNS TRIGGER AS $$
BEGIN
    -- Update order status based on progress completion
    IF NEW.evidence_upload_status = 'COMPLETED' THEN
        UPDATE orders SET status = 'COMPLETED', updated_at = NOW() WHERE id = NEW.order_id;
    ELSIF NEW.survey_status = 'ON_HOLD' OR NEW.penarikan_kabel_status = 'ON_HOLD' 
          OR NEW.instalasi_ont_status = 'ON_HOLD' OR NEW.evidence_upload_status = 'ON_HOLD' THEN
        UPDATE orders SET status = 'ON_HOLD', updated_at = NOW() WHERE id = NEW.order_id;
    ELSIF NEW.survey_status = 'IN_PROGRESS' OR NEW.penarikan_kabel_status = 'IN_PROGRESS' 
          OR NEW.instalasi_ont_status = 'IN_PROGRESS' OR NEW.evidence_upload_status = 'IN_PROGRESS' THEN
        UPDATE orders SET status = 'IN_PROGRESS', updated_at = NOW() WHERE id = NEW.order_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update order status when progress changes
CREATE TRIGGER trigger_update_order_status
    AFTER UPDATE ON order_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_order_status_from_progress();

-- Functions for automatic order number generation
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
    new_number TEXT;
    counter INTEGER;
BEGIN
    -- Get current date in YYYYMMDD format
    SELECT TO_CHAR(NOW(), 'YYYYMMDD') INTO new_number;
    
    -- Get count of orders created today
    SELECT COUNT(*) + 1 INTO counter
    FROM orders 
    WHERE DATE(created_at) = CURRENT_DATE;
    
    -- Format: ORD-YYYYMMDD-XXX
    new_number := 'ORD-' || new_number || '-' || LPAD(counter::TEXT, 3, '0');
    
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate order number
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
        NEW.order_number := generate_order_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_order_number
    BEFORE INSERT ON orders
    FOR EACH ROW
    EXECUTE FUNCTION set_order_number();

-- Function to calculate SLA deadline (3x24 hours = 72 hours)
CREATE OR REPLACE FUNCTION calculate_sla_deadline(start_time TIMESTAMP WITH TIME ZONE)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
    RETURN start_time + INTERVAL '72 hours';
END;
$$ LANGUAGE plpgsql;

-- Function to update order timestamps
CREATE OR REPLACE FUNCTION update_order_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_order_timestamp
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_order_timestamp();

-- Function to check TTI compliance
CREATE OR REPLACE FUNCTION check_tti_compliance(order_id_param BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
    order_record RECORD;
    total_duration INTERVAL;
BEGIN
    SELECT * INTO order_record FROM orders WHERE id = order_id_param;
    
    IF order_record.closed_at IS NOT NULL AND order_record.created_at IS NOT NULL THEN
        total_duration := order_record.closed_at - order_record.created_at;
        
        -- TTI comply if completed within 72 hours (3x24)
        RETURN total_duration <= INTERVAL '72 hours';
    END IF;
    
    RETURN NULL; -- Order not yet completed
END;
$$ LANGUAGE plpgsql;

-- Insert initial bot stats
INSERT INTO bot_stats (total_messages, total_orders, active_orders, completed_orders) 
VALUES (0, 0, 0, 0);

-- Sample users (you can modify these)
INSERT INTO users (telegram_id, username, full_name, role, phone) VALUES
(123456789, 'hd_user1', 'Helpdesk User 1', 'HD', '081234567890'),
(987654321, 'tech_user1', 'Teknisi User 1', 'TEKNISI', '081987654321');

-- Views for reporting
CREATE VIEW order_summary AS
SELECT 
    o.id,
    o.order_number,
    o.customer_name,
    o.sto,
    o.transaction_type,
    o.service_type,
    o.status,
    o.current_stage,
    hd.full_name as hd_name,
    tech.full_name as technician_name,
    o.created_at,
    o.sla_deadline,
    o.tti_comply,
    CASE 
        WHEN o.sla_deadline < NOW() AND o.status != 'CLOSED' THEN true
        ELSE false
    END as is_overdue
FROM orders o
LEFT JOIN users hd ON o.created_by_hd_id = hd.id
LEFT JOIN users tech ON o.assigned_technician_id = tech.id;

CREATE VIEW daily_report AS
SELECT 
    DATE(created_at) as report_date,
    COUNT(*) as total_orders,
    COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_orders,
    COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END) as in_progress_orders,
    COUNT(CASE WHEN status = 'ON_HOLD' THEN 1 END) as on_hold_orders,
    COUNT(CASE WHEN status = 'CLOSED' THEN 1 END) as closed_orders,
    COUNT(CASE WHEN tti_comply = true THEN 1 END) as tti_comply_orders,
    COUNT(CASE WHEN tti_comply = false THEN 1 END) as tti_non_comply_orders
FROM orders
GROUP BY DATE(created_at)
ORDER BY report_date DESC;