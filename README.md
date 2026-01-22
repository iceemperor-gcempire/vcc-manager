# Visual Content Creator Manager

A comprehensive web service for managing AI image generation through ComfyUI integration. This service provides a complete solution for users to create, manage, and organize AI-generated images with an intuitive web interface.

## Features

### Core Functionality
- **Google SSO Authentication**: Secure login using Google accounts
- **Workboard Management**: Customizable templates for different image generation workflows
- **Image Generation Queue**: Asynchronous processing with real-time progress tracking
- **File Management**: Upload and organize reference images
- **Admin Panel**: Comprehensive administration tools for managing users and workboards

### User Features
- Upload and manage reference images for Image-to-Image and ControlNet operations
- Create image generation jobs with custom parameters
- Track job progress and history
- Download and organize generated images
- Tag and categorize images for easy organization

### Admin Features
- Create and manage workboards (generation templates)
- User management and statistics
- System monitoring and job queue management
- Configurable workflow templates using ComfyUI JSON format

## Architecture

### Backend (Node.js/Express)
- RESTful API architecture
- MongoDB for data persistence
- Redis for job queue management
- Bull queue for background processing
- Passport.js for Google OAuth integration
- Multer for file upload handling

### Frontend (React)
- Material-UI for modern, responsive interface
- React Query for efficient data fetching
- React Router for navigation
- Context API for state management

### Infrastructure
- Docker containerization
- Nginx reverse proxy
- MongoDB and Redis services
- Volume persistence for uploaded files

## Prerequisites

- Docker and Docker Compose
- Google OAuth credentials
- ComfyUI server (running separately)

## Quick Start

### 1. Clone and Setup

```bash
git clone <repository-url>
cd vcc-manager-claude
cp .env.example .env
```

### 2. Configure Environment

Edit `.env` file with your settings:

```bash
# Required: Google OAuth credentials
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Required: Admin email addresses
ADMIN_EMAILS=admin@example.com

# Required: Secure secrets (generate strong random strings)
SESSION_SECRET=your_session_secret_key
JWT_SECRET=your_jwt_secret_key

# Optional: ComfyUI server URL
COMFY_UI_BASE_URL=http://localhost:8188
```

### 3. Start Development Environment

```bash
# Start only database services for development
docker-compose -f docker-compose.dev.yml up mongodb redis -d

# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..

# Start backend (development mode)
npm run dev

# Start frontend (in another terminal)
cd frontend && npm start
```

### 4. Start Production Environment

```bash
# Copy production environment
cp .env.production .env

# Edit .env with your production values

# Start all services
docker-compose up -d
```

The application will be available at:
- Production: http://localhost (port 80)
- Development: http://localhost:3001 (frontend), http://localhost:3000 (backend API)

## Configuration

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost/auth/google/callback`
6. Copy Client ID and Client Secret to `.env`

### ComfyUI Integration

1. Install and run ComfyUI server
2. Export workflows as API format from ComfyUI
3. Create workboards in the admin panel using the exported JSON
4. Use mustache templates for dynamic values (e.g., `{{##prompt##}}`)

### Workboard Configuration

Workboards define the workflow templates for image generation. They contain:

- **Base Input Fields**: Standard fields like model, prompt, image size
- **Additional Input Fields**: Custom fields defined by admin
- **Workflow Data**: ComfyUI workflow JSON with mustache template variables

Example workflow template variable injection:
```json
{
  "prompt": "{{##prompt##}}",
  "negative_prompt": "{{##negative_prompt##}}",
  "model": "{{##model##}}",
  "width": "{{##width##}}",
  "height": "{{##height##}}"
}
```

## API Documentation

### Authentication
- `GET /api/auth/google` - Initiate Google OAuth
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### User Management
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/stats` - Get user statistics

### Workboards
- `GET /api/workboards` - List workboards
- `GET /api/workboards/:id` - Get workboard details
- `POST /api/workboards` - Create workboard (admin)
- `PUT /api/workboards/:id` - Update workboard (admin)

### Image Generation
- `POST /api/jobs/generate` - Create generation job
- `GET /api/jobs/my` - Get user's jobs
- `GET /api/jobs/:id` - Get job details
- `DELETE /api/jobs/:id` - Delete job

### Image Management
- `POST /api/images/upload` - Upload reference image
- `GET /api/images/uploaded` - List uploaded images
- `GET /api/images/generated` - List generated images

## File Structure

```
├── src/                 # Backend source code
│   ├── models/         # MongoDB schemas
│   ├── routes/         # API endpoints
│   ├── services/       # Business logic
│   ├── middleware/     # Express middleware
│   ├── config/         # Configuration files
│   └── utils/          # Utility functions
├── frontend/           # React frontend
│   ├── src/
│   │   ├── components/ # React components
│   │   ├── pages/      # Page components
│   │   ├── services/   # API clients
│   │   └── contexts/   # React contexts
├── uploads/            # File storage
├── docker-compose.yml  # Production compose
├── docker-compose.dev.yml # Development compose
└── README.md
```

## Development

### Backend Development
```bash
npm run dev          # Start with nodemon
npm test             # Run tests
```

### Frontend Development
```bash
cd frontend
npm start            # Start development server
npm run build        # Build for production
npm test             # Run tests
```

### Database Management
```bash
# Connect to MongoDB
docker exec -it vcc-mongodb mongo -u admin -p password

# Connect to Redis
docker exec -it vcc-redis redis-cli
```

## Production Deployment

1. Set up production environment variables
2. Configure reverse proxy (Nginx included)
3. Set up SSL certificates
4. Configure ComfyUI server
5. Run with Docker Compose

```bash
# Production deployment
docker-compose up -d

# View logs
docker-compose logs -f

# Scale services
docker-compose up -d --scale backend=3
```

## Security Considerations

- Use strong, unique secrets for SESSION_SECRET and JWT_SECRET
- Regularly update dependencies
- Use HTTPS in production
- Implement rate limiting
- Monitor file uploads for malicious content
- Regularly backup database

## Troubleshooting

### Common Issues

1. **Google OAuth Error**: Verify redirect URI matches exactly
2. **ComfyUI Connection Failed**: Check COMFY_UI_BASE_URL and network connectivity
3. **File Upload Issues**: Verify upload directory permissions
4. **Database Connection**: Check MongoDB connection string and credentials

### Logs

```bash
# View all logs
docker-compose logs

# View specific service logs
docker-compose logs backend
docker-compose logs frontend
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review existing issues
3. Create a new issue with detailed information

## Changelog

### v1.0.0
- Initial release
- Google SSO authentication
- Basic workboard management
- Image generation queue
- File upload system
- Admin panel
- Docker deployment