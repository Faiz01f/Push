<?php
/**
 * Plugin Name: DiziPush - Web Push Notifications
 * Plugin URI: https://github.com/your-org/dizipush
 * Description: Integrate DiziPush web push notifications with your WordPress site. Send push notifications automatically when you publish posts, or manually create campaigns.
 * Version: 1.0.0
 * Author: DiziPush Team
 * Author URI: https://dizipush.com
 * License: MIT
 * License URI: https://opensource.org/licenses/MIT
 * Text Domain: dizipush
 * Domain Path: /languages
 * Requires at least: 5.0
 * Tested up to: 6.4
 * Requires PHP: 8.0
 * Network: false
 * 
 * @package DiziPush
 * @author DiziPush Team
 * @since 1.0.0
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('DIZIPUSH_VERSION', '1.0.0');
define('DIZIPUSH_PLUGIN_FILE', __FILE__);
define('DIZIPUSH_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('DIZIPUSH_PLUGIN_URL', plugin_dir_url(__FILE__));
define('DIZIPUSH_PLUGIN_BASENAME', plugin_basename(__FILE__));

// Composer autoloader
if (file_exists(DIZIPUSH_PLUGIN_DIR . 'vendor/autoload.php')) {
    require_once DIZIPUSH_PLUGIN_DIR . 'vendor/autoload.php';
}

/**
 * Main DiziPush Plugin Class
 */
class DiziPush_Plugin {
    
    /**
     * Single instance of the plugin
     */
    private static $instance = null;
    
    /**
     * Plugin settings
     */
    public $settings;
    
    /**
     * API client
     */
    public $api;
    
    /**
     * Get single instance
     */
    public static function instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    /**
     * Constructor
     */
    private function __construct() {
        $this->init_hooks();
        $this->load_dependencies();
    }
    
    /**
     * Initialize hooks
     */
    private function init_hooks() {
        add_action('init', array($this, 'load_textdomain'));
        add_action('admin_init', array($this, 'admin_init'));
        add_action('admin_menu', array($this, 'admin_menu'));
        add_action('admin_enqueue_scripts', array($this, 'admin_scripts'));
        add_action('wp_enqueue_scripts', array($this, 'frontend_scripts'));
        
        // Post publishing hooks
        add_action('publish_post', array($this, 'on_post_published'), 10, 2);
        add_action('publish_page', array($this, 'on_page_published'), 10, 2);
        
        // Custom post type support
        add_action('publish_product', array($this, 'on_custom_post_published'), 10, 2);
        
        // Meta boxes
        add_action('add_meta_boxes', array($this, 'add_meta_boxes'));
        add_action('save_post', array($this, 'save_meta_boxes'));
        
        // AJAX handlers
        add_action('wp_ajax_dizipush_test_connection', array($this, 'ajax_test_connection'));
        add_action('wp_ajax_dizipush_send_test_push', array($this, 'ajax_send_test_push'));
        add_action('wp_ajax_dizipush_send_manual_push', array($this, 'ajax_send_manual_push'));
        
        // Shortcodes
        add_shortcode('dizipush_subscribe', array($this, 'subscribe_shortcode'));
        add_shortcode('dizipush_stats', array($this, 'stats_shortcode'));
        
        // Dashboard widget
        add_action('wp_dashboard_setup', array($this, 'dashboard_widget'));
        
        // Plugin activation/deactivation
        register_activation_hook(DIZIPUSH_PLUGIN_FILE, array($this, 'activate'));
        register_deactivation_hook(DIZIPUSH_PLUGIN_FILE, array($this, 'deactivate'));
    }
    
    /**
     * Load plugin dependencies
     */
    private function load_dependencies() {
        require_once DIZIPUSH_PLUGIN_DIR . 'includes/class-settings.php';
        require_once DIZIPUSH_PLUGIN_DIR . 'includes/class-api.php';
        require_once DIZIPUSH_PLUGIN_DIR . 'includes/class-notification.php';
        require_once DIZIPUSH_PLUGIN_DIR . 'includes/functions.php';
        
        $this->settings = new DiziPush_Settings();
        $this->api = new DiziPush_API();
    }
    
    /**
     * Load text domain for translations
     */
    public function load_textdomain() {
        load_plugin_textdomain('dizipush', false, dirname(DIZIPUSH_PLUGIN_BASENAME) . '/languages');
    }
    
    /**
     * Admin initialization
     */
    public function admin_init() {
        $this->settings->init();
        
        // Check SSL requirement
        if (!is_ssl() && !is_admin()) {
            add_action('admin_notices', array($this, 'ssl_notice'));
        }
    }
    
    /**
     * Add admin menu
     */
    public function admin_menu() {
        add_menu_page(
            __('DiziPush', 'dizipush'),
            __('DiziPush', 'dizipush'),
            'manage_options',
            'dizipush',
            array($this, 'admin_page_main'),
            'dashicons-megaphone',
            30
        );
        
        add_submenu_page(
            'dizipush',
            __('Settings', 'dizipush'),
            __('Settings', 'dizipush'),
            'manage_options',
            'dizipush-settings',
            array($this, 'admin_page_settings')
        );
        
        add_submenu_page(
            'dizipush',
            __('Analytics', 'dizipush'),
            __('Analytics', 'dizipush'),
            'manage_options',
            'dizipush-analytics',
            array($this, 'admin_page_analytics')
        );
        
        add_submenu_page(
            'dizipush',
            __('Test Push', 'dizipush'),
            __('Test Push', 'dizipush'),
            'manage_options',
            'dizipush-test',
            array($this, 'admin_page_test')
        );
    }
    
    /**
     * Enqueue admin scripts and styles
     */
    public function admin_scripts($hook) {
        if (strpos($hook, 'dizipush') === false && $hook !== 'post.php' && $hook !== 'post-new.php') {
            return;
        }
        
        wp_enqueue_style(
            'dizipush-admin', 
            DIZIPUSH_PLUGIN_URL . 'assets/admin.css', 
            array(), 
            DIZIPUSH_VERSION
        );
        
        wp_enqueue_script(
            'dizipush-admin', 
            DIZIPUSH_PLUGIN_URL . 'assets/admin.js', 
            array('jquery'), 
            DIZIPUSH_VERSION, 
            true
        );
        
        wp_localize_script('dizipush-admin', 'dizipush_ajax', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('dizipush_nonce'),
            'strings' => array(
                'testing_connection' => __('Testing connection...', 'dizipush'),
                'connection_success' => __('Connection successful!', 'dizipush'),
                'connection_error' => __('Connection failed. Please check your settings.', 'dizipush'),
                'sending_test' => __('Sending test notification...', 'dizipush'),
                'test_sent' => __('Test notification sent!', 'dizipush'),
                'send_error' => __('Failed to send notification.', 'dizipush'),
            )
        ));
    }
    
    /**
     * Enqueue frontend scripts
     */
    public function frontend_scripts() {
        if (!$this->is_configured()) {
            return;
        }
        
        $settings = $this->settings->get_all();
        
        // Only load if push notifications are enabled
        if (!$settings['enabled']) {
            return;
        }
        
        wp_enqueue_script(
            'dizipush-client', 
            DIZIPUSH_PLUGIN_URL . 'assets/client.js', 
            array(), 
            DIZIPUSH_VERSION, 
            true
        );
        
        wp_localize_script('dizipush-client', 'dizipush_config', array(
            'api_url' => $settings['api_url'],
            'project_id' => $settings['project_id'],
            'vapid_public_key' => $settings['vapid_public_key'],
            'sw_url' => home_url('/sw.js'),
            'prompt_settings' => array(
                'enabled' => $settings['prompt_enabled'],
                'delay' => $settings['prompt_delay'],
                'message' => $settings['prompt_message'],
            )
        ));
    }
    
    /**
     * Handle post publication
     */
    public function on_post_published($post_id, $post) {
        $this->handle_post_published($post_id, $post, 'post');
    }
    
    /**
     * Handle page publication
     */
    public function on_page_published($post_id, $post) {
        $this->handle_post_published($post_id, $post, 'page');
    }
    
    /**
     * Handle custom post type publication
     */
    public function on_custom_post_published($post_id, $post) {
        $this->handle_post_published($post_id, $post, $post->post_type);
    }
    
    /**
     * Handle post publication (common logic)
     */
    private function handle_post_published($post_id, $post, $post_type) {
        // Skip auto-saves and revisions
        if (wp_is_post_autosave($post_id) || wp_is_post_revision($post_id)) {
            return;
        }
        
        $settings = $this->settings->get_all();
        
        // Check if auto-push is enabled for this post type
        if (!$settings['enabled'] || !$settings['auto_push_enabled']) {
            return;
        }
        
        $enabled_post_types = $settings['auto_push_post_types'] ?? array('post');
        if (!in_array($post_type, $enabled_post_types)) {
            return;
        }
        
        // Check if this specific post should be sent
        $send_push = get_post_meta($post_id, '_dizipush_send', true);
        if ($send_push === 'no') {
            return;
        }
        
        // Get custom settings for this post
        $custom_title = get_post_meta($post_id, '_dizipush_title', true);
        $custom_body = get_post_meta($post_id, '_dizipush_body', true);
        $custom_image = get_post_meta($post_id, '_dizipush_image', true);
        $custom_segment = get_post_meta($post_id, '_dizipush_segment', true);
        
        // Prepare notification data
        $notification = new DiziPush_Notification();
        $notification->set_post($post)
                    ->set_custom_title($custom_title)
                    ->set_custom_body($custom_body)
                    ->set_custom_image($custom_image)
                    ->set_segment($custom_segment ?: $settings['default_segment']);
        
        // Send the notification
        $result = $this->api->send_campaign($notification->to_array());
        
        if ($result) {
            // Store campaign ID for tracking
            update_post_meta($post_id, '_dizipush_campaign_id', $result['id']);
            update_post_meta($post_id, '_dizipush_sent_at', current_time('mysql'));
            
            // Log success
            error_log("DiziPush: Successfully sent push notification for post {$post_id}");
        } else {
            // Log error
            error_log("DiziPush: Failed to send push notification for post {$post_id}");
        }
    }
    
    /**
     * Add meta boxes to posts
     */
    public function add_meta_boxes() {
        $post_types = array('post', 'page', 'product');
        
        foreach ($post_types as $post_type) {
            add_meta_box(
                'dizipush-settings',
                __('DiziPush Notification', 'dizipush'),
                array($this, 'meta_box_content'),
                $post_type,
                'side',
                'high'
            );
        }
    }
    
    /**
     * Meta box content
     */
    public function meta_box_content($post) {
        wp_nonce_field('dizipush_meta_box', 'dizipush_meta_box_nonce');
        
        $send_push = get_post_meta($post->ID, '_dizipush_send', true) ?: 'yes';
        $custom_title = get_post_meta($post->ID, '_dizipush_title', true);
        $custom_body = get_post_meta($post->ID, '_dizipush_body', true);
        $custom_image = get_post_meta($post->ID, '_dizipush_image', true);
        $custom_segment = get_post_meta($post->ID, '_dizipush_segment', true);
        
        include DIZIPUSH_PLUGIN_DIR . 'templates/meta-box.php';
    }
    
    /**
     * Save meta box data
     */
    public function save_meta_boxes($post_id) {
        if (!isset($_POST['dizipush_meta_box_nonce']) || 
            !wp_verify_nonce($_POST['dizipush_meta_box_nonce'], 'dizipush_meta_box')) {
            return;
        }
        
        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
            return;
        }
        
        if (!current_user_can('edit_post', $post_id)) {
            return;
        }
        
        // Save meta fields
        $fields = array('send', 'title', 'body', 'image', 'segment');
        foreach ($fields as $field) {
            $key = "_dizipush_{$field}";
            if (isset($_POST[$key])) {
                update_post_meta($post_id, $key, sanitize_text_field($_POST[$key]));
            }
        }
    }
    
    /**
     * Subscribe shortcode
     */
    public function subscribe_shortcode($atts) {
        $atts = shortcode_atts(array(
            'button_text' => __('Enable Notifications', 'dizipush'),
            'success_message' => __('Thanks for subscribing!', 'dizipush'),
            'class' => 'dizipush-subscribe-btn',
        ), $atts);
        
        if (!$this->is_configured()) {
            return '';
        }
        
        ob_start();
        include DIZIPUSH_PLUGIN_DIR . 'templates/subscribe-button.php';
        return ob_get_clean();
    }
    
    /**
     * Stats shortcode
     */
    public function stats_shortcode($atts) {
        $atts = shortcode_atts(array(
            'show' => 'subscribers,campaigns', // comma-separated list
        ), $atts);
        
        if (!$this->is_configured()) {
            return '';
        }
        
        $stats = $this->api->get_stats();
        if (!$stats) {
            return '';
        }
        
        $show = explode(',', $atts['show']);
        
        ob_start();
        include DIZIPUSH_PLUGIN_DIR . 'templates/stats-widget.php';
        return ob_get_clean();
    }
    
    /**
     * Add dashboard widget
     */
    public function dashboard_widget() {
        if (!$this->is_configured()) {
            return;
        }
        
        wp_add_dashboard_widget(
            'dizipush_stats',
            __('DiziPush Statistics', 'dizipush'),
            array($this, 'dashboard_widget_content')
        );
    }
    
    /**
     * Dashboard widget content
     */
    public function dashboard_widget_content() {
        $stats = $this->api->get_stats();
        include DIZIPUSH_PLUGIN_DIR . 'templates/dashboard-widget.php';
    }
    
    /**
     * Main admin page
     */
    public function admin_page_main() {
        $stats = $this->is_configured() ? $this->api->get_stats() : null;
        include DIZIPUSH_PLUGIN_DIR . 'templates/admin-main.php';
    }
    
    /**
     * Settings admin page
     */
    public function admin_page_settings() {
        include DIZIPUSH_PLUGIN_DIR . 'templates/admin-settings.php';
    }
    
    /**
     * Analytics admin page
     */
    public function admin_page_analytics() {
        $analytics = $this->is_configured() ? $this->api->get_analytics() : null;
        include DIZIPUSH_PLUGIN_DIR . 'templates/admin-analytics.php';
    }
    
    /**
     * Test push admin page
     */
    public function admin_page_test() {
        include DIZIPUSH_PLUGIN_DIR . 'templates/admin-test.php';
    }
    
    /**
     * AJAX: Test connection
     */
    public function ajax_test_connection() {
        check_ajax_referer('dizipush_nonce', 'nonce');
        
        $result = $this->api->test_connection();
        
        wp_send_json(array(
            'success' => $result !== false,
            'data' => $result
        ));
    }
    
    /**
     * AJAX: Send test push
     */
    public function ajax_send_test_push() {
        check_ajax_referer('dizipush_nonce', 'nonce');
        
        $result = $this->api->send_test_notification();
        
        wp_send_json(array(
            'success' => $result !== false,
            'data' => $result
        ));
    }
    
    /**
     * AJAX: Send manual push
     */
    public function ajax_send_manual_push() {
        check_ajax_referer('dizipush_nonce', 'nonce');
        
        $title = sanitize_text_field($_POST['title']);
        $body = sanitize_text_field($_POST['body']);
        $url = esc_url_raw($_POST['url']);
        $image = esc_url_raw($_POST['image']);
        $segment = sanitize_text_field($_POST['segment']);
        
        $notification_data = array(
            'name' => $title,
            'payload' => array(
                'title' => $title,
                'body' => $body,
                'url' => $url,
                'image' => $image,
                'icon' => $this->get_site_icon(),
            ),
            'segmentId' => $segment,
            'type' => 'INSTANT'
        );
        
        $result = $this->api->send_campaign($notification_data);
        
        wp_send_json(array(
            'success' => $result !== false,
            'data' => $result
        ));
    }
    
    /**
     * SSL requirement notice
     */
    public function ssl_notice() {
        ?>
        <div class="notice notice-warning is-dismissible">
            <p>
                <strong><?php _e('DiziPush Warning:', 'dizipush'); ?></strong>
                <?php _e('Push notifications require HTTPS. Please enable SSL on your website.', 'dizipush'); ?>
            </p>
        </div>
        <?php
    }
    
    /**
     * Check if plugin is properly configured
     */
    public function is_configured() {
        $settings = $this->settings->get_all();
        return !empty($settings['api_key']) && !empty($settings['project_id']);
    }
    
    /**
     * Get site icon URL
     */
    private function get_site_icon() {
        $icon_id = get_option('site_icon');
        if ($icon_id) {
            return wp_get_attachment_image_url($icon_id, 'full');
        }
        
        // Fallback to theme customizer logo
        $custom_logo_id = get_theme_mod('custom_logo');
        if ($custom_logo_id) {
            return wp_get_attachment_image_url($custom_logo_id, 'full');
        }
        
        // Default icon
        return DIZIPUSH_PLUGIN_URL . 'assets/default-icon.png';
    }
    
    /**
     * Plugin activation
     */
    public function activate() {
        // Create default settings
        $default_settings = array(
            'enabled' => false,
            'auto_push_enabled' => true,
            'auto_push_post_types' => array('post'),
            'prompt_enabled' => true,
            'prompt_delay' => 3000,
            'prompt_message' => __('Enable notifications to get the latest updates!', 'dizipush'),
            'default_segment' => '',
        );
        
        add_option('dizipush_settings', $default_settings);
        
        // Flush rewrite rules
        flush_rewrite_rules();
    }
    
    /**
     * Plugin deactivation
     */
    public function deactivate() {
        // Flush rewrite rules
        flush_rewrite_rules();
    }
}

// Initialize the plugin
DiziPush_Plugin::instance();

/**
 * Helper function to get plugin instance
 */
function dizipush() {
    return DiziPush_Plugin::instance();
}