# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Prompt Data Management System** (#11)
  - New PromptData model for saving and managing prompts
  - Fields: name, memo, representative image, prompt, negative prompt, seed
  - CRUD API for prompt data management
  - Usage tracking with usage count
  - Prompt Data list page with grid view, search, and pagination
  - ImageSelectDialog component for selecting representative images
  - Save prompt from Job History with auto-populated fields
  - Load saved prompts in Image Generation form
  - Quick generate from Prompt Data list with workboard selection
  - Copy prompt to clipboard functionality
  - Sidebar menu item for Prompt Data

- **Server Management System** (#5)
  - New Server model supporting multiple server types (ComfyUI, OpenAI Compatible)
  - Server output type configuration (Image, Text)
  - Health check functionality with automatic status monitoring
  - Admin UI for server CRUD operations
  - Server selection dropdown in workboard configuration
  - API key and timeout configuration per server

- **Image Type for Additional Input Fields** (#12)
  - New 'image' type for additionalInputFields in workboard schema
  - Configurable maxImages setting (1-3) for reference image fields
  - CustomImageField component with gallery selection and drag-drop upload
  - Flexible reference image handling per workboard configuration

- **Enhanced Pagination System** (#9)
  - Reusable Pagination component for consistent behavior across all pages
  - Direct page navigation with input dialog for quick page jumping
  - Smart pagination algorithm showing maximum 3 pages with current page centered
  - Enhanced navigation controls with first/last/previous/next buttons
  - Mobile-responsive design with touch-friendly button sizing
  - Configurable options for different use cases

### Changed
- **Admin Panel UI Restructure**
  - Split AdminPanel tabs into individual sidebar menu items
  - New admin routes: /admin/dashboard, /admin/users, /admin/workboards, /admin/servers, /admin/stats
  - Improved navigation UX by removing nested tab navigation
  - Dedicated pages for each admin function

- **Workboard Form Standardization**
  - Extracted WorkboardBasicInfoForm as shared component
  - Consistent form fields across create, edit, and detail edit modes
  - Replaced serverUrl text field with server selection dropdown

### Fixed
- **My Images Page Pagination Overflow** (#8)
  - Fixed horizontal overflow issue in My Images page pagination
  - Applied smart pagination system to prevent layout expansion
  - Consistent pagination behavior with Job History page

- **Server Route Middleware Error**
  - Fixed authenticateUser → verifyJWT import error in servers route
  - Resolved backend startup failure due to undefined middleware

### Enhanced
- **Code Architecture Improvements**
  - Componentized pagination functionality for reusability
  - Reduced code duplication across JobHistory and MyImages pages
  - Improved maintainability with centralized pagination logic
  - Modularized workboard form components for consistency

## [1.1.0] - 2026-01-27

### Added

#### User Experience Improvements
- **User Approval System**
  - Comprehensive user approval workflow for new registrations
  - Admin panel for managing user approval/rejection
  - Automatic admin status detection based on email configuration
  - Enhanced authentication flow with approval status checking
  - Improved error messages for pending/rejected users

- **Mobile Navigation Enhancement**
  - Hamburger menu button for mobile sidebar access
  - Responsive header title (VCCM on mobile, full name on desktop) 
  - Touch-friendly menu item sizing and spacing
  - Improved mobile drawer functionality with better UX

#### Dashboard Redesign
- **Streamlined User Dashboard**
  - Removed unnecessary statistics for regular users
  - Focus on essential information: server queue status and personal job status
  - Only show waiting/processing jobs (removed completed/failed from server stats)
  - Removed recent jobs section for cleaner interface
  - Responsive quick action buttons with improved layout

#### Data Management
- **Cascade Delete for Job History**
  - Automatic deletion of associated generated images when deleting jobs
  - Physical file cleanup to prevent orphaned data
  - Comprehensive error handling for file deletion failures
  - Enhanced logging for deletion process tracking

### Fixed

#### Critical Bug Fixes
- **iPhone Safari Download Issues** (#1)
  - Fixed image download failures in iOS Safari browser
  - Implemented blob-based download approach to prevent CORS issues
  - Added fallback for popup blocking scenarios
  - Special handling for iOS Safari with user guidance messages
  - Improved error handling with user-friendly feedback

- **Production Deployment Scripts** (#4)
  - Fixed stop-production.sh to use proper Docker Compose shutdown
  - Replaced process-based termination with safe container management
  - Added environment file validation and status checking
  - Consistent styling and messaging with deployment scripts

#### Mobile UI Improvements
- **Job History Mobile Optimization**
  - Fixed horizontal overflow issues caused by pagination buttons
  - Implemented smart pagination with limited visible page numbers (max 3)
  - Enhanced responsive grid layouts for job metadata display
  - Improved text truncation and button sizing for mobile devices
  - Set job history to display exactly 10 items per page

### Enhanced

#### Authentication & User Management
- **Improved Login Flow**
  - Clear password validation with step-by-step feedback
  - Specific error messages for different approval states
  - Enhanced Google OAuth integration with approval checking
  - Better user feedback with toast notifications and icons

#### File Management
- **Reference Image Handling**
  - Proper cleanup of reference image connections during job deletion
  - Updated reference tracking when jobs are removed
  - Maintained data integrity across image relationships

#### Production Infrastructure
- **Deployment Script Improvements**
  - Enhanced error handling and user guidance
  - Consistent color-coded output for better readability
  - Added data preservation notices and safety checks
  - Improved Docker Compose integration

### Technical Improvements

#### Code Quality
- **Component Optimization**
  - Removed unused components and imports
  - Streamlined data fetching for improved performance
  - Better responsive design patterns implementation
  - Enhanced accessibility for mobile users

#### Error Handling
- **Enhanced Logging**
  - Comprehensive deletion process tracking
  - Better error messages for file operations
  - Improved debugging information for troubleshooting

### Configuration Updates

#### Mobile Responsiveness
- **Responsive Breakpoints**
  - Optimized layouts for different screen sizes
  - Improved touch targets for mobile interaction
  - Better text scaling and spacing for readability

#### User Interface
- **Design System Updates**
  - Consistent Material-UI component usage
  - Improved color schemes for status indicators
  - Enhanced visual hierarchy in dashboard layout

### Bug Fixes by Issue

- **#1**: iPhone Safari image download failures → Fixed with blob-based downloads and iOS-specific handling
- **#3**: Job deletion should remove associated images → Implemented cascade delete with file cleanup
- **#4**: Production stop script using wrong shutdown method → Fixed to use Docker Compose properly
- **#6**: Dashboard redesign for regular users and mobile menu access → Complete UI/UX overhaul

## [1.0.0] - 2026-01-22

### Added

#### Core Features
- **User Authentication System**
  - JWT-based authentication with secure token management
  - Role-based access control (admin/user)
  - User registration and login functionality
  - Password hashing with bcrypt

- **Workboard Management System**
  - ComfyUI workflow template management
  - Admin-only editing capabilities for workboard structure
  - Dynamic input field configuration
  - Workflow JSON data management with Mustache templating
  - Workboard usage statistics and version tracking

- **Image Generation Pipeline**
  - Bull Queue integration for background job processing
  - ComfyUI WebSocket communication for workflow execution
  - Real-time progress tracking and status updates
  - Support for multiple AI models and image sizes
  - Reference image upload and management

- **File Management**
  - Multer-based file upload with validation
  - Generated image storage and serving
  - Image metadata and download tracking
  - Automatic file organization in categorized directories

- **Monitoring Dashboard**
  - Real-time system statistics
  - Job queue monitoring with configurable update intervals
  - User activity tracking
  - Admin panel for system management

#### Frontend Components
- **React 18** application with modern hooks
- **Material-UI** for consistent design system
- **React Query** for efficient data fetching and caching
- **React Router** for client-side routing
- **React Hook Form** for form management and validation

#### Backend Services
- **Express.js** REST API with comprehensive routing
- **MongoDB** with Mongoose ODM for data modeling
- **Redis** for session storage and job queue
- **Bull** for background job processing
- **Helmet** for security headers
- **Morgan** for request logging

#### Infrastructure
- **Docker** containerization with multi-service architecture
- **Nginx** reverse proxy with static file serving
- **Docker Compose** for development and production environments
- **Environment-based configuration** management

### Technical Implementations

#### Authentication & Authorization
- JWT middleware for route protection
- Admin route guards for sensitive operations
- Secure password storage with salt rounds
- Session management with automatic token refresh

#### Database Models
- User model with role-based permissions
- Workboard model with version control
- ImageGenerationJob model with status tracking
- GeneratedImage model with metadata storage
- UploadedImage model for reference files

#### API Endpoints
- RESTful API design with consistent response formats
- Comprehensive error handling and validation
- File upload endpoints with size and type restrictions
- Admin-specific endpoints for system management

#### Queue Management
- Bull Queue for reliable job processing
- Redis-backed queue persistence
- Job retry mechanisms with exponential backoff
- Progress tracking and real-time updates

### Configuration Features

#### Environment Variables
- Comprehensive environment configuration for all services
- Development and production environment separation
- Configurable monitoring update intervals
- Flexible file upload and storage settings

#### Monitoring Configuration
- **Queue Status**: 5-second update interval (configurable)
- **Recent Jobs**: 15-second update interval (configurable)
- **User Stats**: 30-second update interval (configurable)
- External configuration via environment variables

### Fixed Issues

#### Image Display Problems
- **Issue**: Generated images not displaying in gallery and history
- **Cause**: Nginx static file routing conflicting with `/uploads` proxy
- **Solution**: Modified nginx.conf to exclude `/uploads` from static file patterns
- **Files Modified**: `nginx.conf`, `Dockerfile.frontend`

#### Job Completion Tracking
- **Issue**: Image generation jobs completing without saving result images
- **Cause**: `ImageGenerationJob.updateStatus()` method not handling `resultImages`
- **Solution**: Added `resultImages` field processing in updateStatus method
- **Files Modified**: `src/models/ImageGenerationJob.js`

#### Workflow Data Management
- **Issue**: Workflow JSON not loading in admin edit dialogs
- **Cause**: General workboard API excluding workflowData with `.select('-workflowData')`
- **Solution**: Created admin-specific API endpoint with complete data access
- **Files Modified**: 
  - `src/routes/workboards.js` (added `/admin/:id` endpoint)
  - `frontend/src/services/api.js` (added `getByIdAdmin` method)
  - `frontend/src/components/admin/WorkboardManagement.js` (updated data fetching)

#### Access Control Implementation
- **Issue**: Workboard editing available to all users
- **Solution**: Moved all editing functionality to admin-only sections
- **Files Modified**: 
  - `frontend/src/pages/Workboards.js` (removed edit capabilities)
  - `frontend/src/components/admin/WorkboardManagement.js` (comprehensive edit interface)

### Development Tools & Debugging

#### Enhanced Logging
- Comprehensive debug logging for image generation pipeline
- ComfyUI response tracking and validation
- File system operation monitoring
- Queue job lifecycle tracking

#### Error Handling
- Graceful error recovery for failed image generations
- Timeout handling for ComfyUI communication
- File upload error validation and user feedback
- Database connection error handling

### Performance Optimizations

#### Frontend Optimizations
- React Query caching for API responses
- Component memoization for expensive renders
- Optimized image loading and display
- Efficient re-rendering with proper dependency arrays

#### Backend Optimizations
- MongoDB indexing for frequently queried fields
- Redis caching for session and queue data
- Efficient file serving with proper headers
- Connection pooling for database operations

### Security Enhancements

#### Input Validation
- Comprehensive form validation on both client and server
- File type and size restrictions for uploads
- SQL injection protection with Mongoose
- XSS prevention with proper content encoding

#### Authentication Security
- Secure JWT implementation with proper expiration
- Password strength requirements
- Rate limiting for authentication endpoints
- CORS configuration for cross-origin requests

### Documentation

#### Code Documentation
- Inline code comments for complex business logic
- API endpoint documentation with parameter descriptions
- Database schema documentation with relationships
- Configuration variable explanations

#### Development Documentation
- Comprehensive setup and installation guide
- Architecture overview with service relationships
- Troubleshooting guide for common issues
- Deployment instructions for different environments

---

## Development Notes

### Known Limitations
- Single ComfyUI server support (multi-server planned for future)
- Limited batch processing capabilities
- Basic user quota management

### Future Enhancements
- Advanced workflow versioning system
- Multi-tenant architecture support
- Enhanced monitoring and alerting
- Plugin system for custom extensions

### Dependencies
- Node.js 18+
- MongoDB 7.0+
- Redis 7.2+
- Docker & Docker Compose
- ComfyUI server instance

---

**Release Date**: January 22, 2026  
**Contributors**: Claude Code Assistant