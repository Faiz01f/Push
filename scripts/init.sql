-- DiziPush Database Initialization Script
-- Creates the main database and initial configurations

-- Create database (if running as superuser)
-- CREATE DATABASE dizipush OWNER dizipush;

-- Connect to dizipush database
\c dizipush;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For full-text search

-- Create custom types and domains
CREATE DOMAIN email AS TEXT CHECK (VALUE ~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$');

-- Set default privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO dizipush;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO dizipush;

-- Create indexes for performance (Prisma will create most, but these are extras)
-- Note: Most indexes will be created by Prisma migrations

-- Full-text search indexes (will be created after tables exist)
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscribers_search 
-- ON subscribers USING GIN (to_tsvector('english', coalesce(browser, '') || ' ' || coalesce(os, '') || ' ' || coalesce(country, '')));

-- Partial indexes for active subscribers
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscribers_active 
-- ON subscribers (project_id, last_seen) WHERE status = 'ACTIVE';

-- Event time-series indexes
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_time_series 
-- ON events (project_id, type, timestamp DESC);

-- Campaign performance indexes
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_send_attempts_campaign_status 
-- ON send_attempts (campaign_id, status, last_attempt_at);

-- Create functions for common operations
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create function for generating slugs
CREATE OR REPLACE FUNCTION generate_slug(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN lower(regexp_replace(
        regexp_replace(trim(input_text), '[^a-zA-Z0-9\s-]', '', 'g'),
        '\s+', '-', 'g'
    ));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function for calculating engagement score
CREATE OR REPLACE FUNCTION calculate_engagement_score(
    subscriber_id_param TEXT,
    project_id_param TEXT
) RETURNS NUMERIC AS $$
DECLARE
    click_count INTEGER;
    delivery_count INTEGER;
    days_since_subscribe INTEGER;
    score NUMERIC;
BEGIN
    -- Get click and delivery counts
    SELECT 
        COUNT(CASE WHEN type = 'CLICK' THEN 1 END),
        COUNT(CASE WHEN type = 'DELIVER' THEN 1 END)
    INTO click_count, delivery_count
    FROM events 
    WHERE subscriber_id = subscriber_id_param 
    AND project_id = project_id_param
    AND timestamp > NOW() - INTERVAL '30 days';
    
    -- Get days since subscribe
    SELECT EXTRACT(DAY FROM NOW() - first_seen)
    INTO days_since_subscribe
    FROM subscribers
    WHERE id = subscriber_id_param;
    
    -- Calculate score (0-100)
    IF delivery_count = 0 THEN
        score := 0;
    ELSE
        score := LEAST(100, (click_count::NUMERIC / delivery_count * 100 * 
                            CASE 
                                WHEN days_since_subscribe < 7 THEN 1.2  -- New subscriber boost
                                WHEN days_since_subscribe > 90 THEN 0.8  -- Old subscriber penalty
                                ELSE 1.0 
                            END));
    END IF;
    
    RETURN score;
END;
$$ LANGUAGE plpgsql;

-- Create function for geo distance calculation (for location-based targeting)
CREATE OR REPLACE FUNCTION calculate_distance(
    lat1 DECIMAL, lon1 DECIMAL,
    lat2 DECIMAL, lon2 DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
    R DECIMAL := 6371; -- Earth's radius in kilometers
    dLat DECIMAL;
    dLon DECIMAL;
    a DECIMAL;
    c DECIMAL;
BEGIN
    dLat := radians(lat2 - lat1);
    dLon := radians(lon2 - lon1);
    
    a := sin(dLat/2) * sin(dLat/2) + 
         cos(radians(lat1)) * cos(radians(lat2)) * 
         sin(dLon/2) * sin(dLon/2);
    
    c := 2 * atan2(sqrt(a), sqrt(1-a));
    
    RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create materialized view for analytics (will be refreshed periodically)
-- This will be created after the main tables exist

-- Create function for refreshing analytics
CREATE OR REPLACE FUNCTION refresh_analytics()
RETURNS VOID AS $$
BEGIN
    -- This will be implemented after tables are created
    -- REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_summary;
    PERFORM pg_notify('analytics_refreshed', extract(epoch from now())::text);
END;
$$ LANGUAGE plpgsql;

-- Database maintenance functions
CREATE OR REPLACE FUNCTION cleanup_old_events()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete events older than the retention period
    DELETE FROM events 
    WHERE timestamp < NOW() - INTERVAL '90 days'
    AND type NOT IN ('PERMISSION_GRANTED', 'SUBSCRIBE', 'UNSUBSCRIBE');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log the cleanup
    INSERT INTO audit_logs (org_id, actor_id, action, entity, entity_id, diff, timestamp)
    SELECT 
        p.org_id, 
        'system', 
        'cleanup_events', 
        'events', 
        'batch',
        json_build_object('deleted_count', deleted_count),
        NOW()
    FROM projects p LIMIT 1;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function for database statistics
CREATE OR REPLACE FUNCTION get_database_stats()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'database_size', pg_size_pretty(pg_database_size(current_database())),
        'table_stats', (
            SELECT json_agg(
                json_build_object(
                    'table_name', schemaname||'.'||tablename,
                    'size', pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)),
                    'row_count', n_tup_ins - n_tup_del,
                    'last_vacuum', last_vacuum,
                    'last_analyze', last_analyze
                )
            )
            FROM pg_stat_user_tables
            ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
            LIMIT 20
        ),
        'connection_stats', (
            SELECT json_build_object(
                'total_connections', count(*),
                'active_connections', count(*) FILTER (WHERE state = 'active'),
                'idle_connections', count(*) FILTER (WHERE state = 'idle')
            )
            FROM pg_stat_activity
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for full-text search on common fields
-- These will be added after tables are created by Prisma

-- Performance monitoring view
CREATE OR REPLACE VIEW slow_queries AS
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements
WHERE calls > 100
ORDER BY mean_time DESC
LIMIT 20;

-- Grant permissions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO dizipush;
GRANT SELECT ON slow_queries TO dizipush;

-- Insert initial system data (will be done by seeds)
-- This is handled by the seeding scripts

-- Set timezone
SET timezone = 'UTC';

-- Optimize settings for the database size and expected load
-- These should be adjusted based on your server specifications

-- Connection and memory settings
-- ALTER SYSTEM SET max_connections = 200;
-- ALTER SYSTEM SET shared_buffers = '256MB';
-- ALTER SYSTEM SET effective_cache_size = '1GB';
-- ALTER SYSTEM SET work_mem = '4MB';
-- ALTER SYSTEM SET maintenance_work_mem = '64MB';

-- Query planner settings
-- ALTER SYSTEM SET random_page_cost = 1.1;
-- ALTER SYSTEM SET effective_io_concurrency = 200;

-- WAL settings for better write performance
-- ALTER SYSTEM SET wal_buffers = '16MB';
-- ALTER SYSTEM SET checkpoint_completion_target = 0.9;
-- ALTER SYSTEM SET wal_writer_delay = '200ms';

-- Logging settings
-- ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log slow queries
-- ALTER SYSTEM SET log_checkpoints = on;
-- ALTER SYSTEM SET log_connections = on;
-- ALTER SYSTEM SET log_disconnections = on;

-- Uncomment and reload config to apply system settings:
-- SELECT pg_reload_conf();

COMMIT;