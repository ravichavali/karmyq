# Karmyq - Community Mutual Aid Platform 🤝

[![Version](https://img.shields.io/badge/version-1.0-blue.svg)](https://github.com/ravichavali/karmyq/releases/tag/v1.0)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

A trust-based community platform where people help each other without money, building reputation through karma. Based on Dunbar's number (max 150 members per community) for authentic, manageable communities.

## ✨ Features

### Complete MVP (v1.0)
- ✅ **User Authentication**: Registration, login with JWT tokens
- ✅ **Communities**: Create and manage communities (max 150 members)
- ✅ **Community Norms**: Propose and vote on community guidelines
- ✅ **Help Requests**: Post help requests with urgency levels
- ✅ **Help Offers**: Offer skills and resources to your community
- ✅ **Smart Matching**: Automatic matching between requests and offers
- ✅ **Karma System**: Earn karma points for helping others
- ✅ **Trust Scores**: 0-100 trust score based on karma and behavior
- ✅ **Real-time Notifications**: Server-Sent Events for instant updates
- ✅ **Real-time Messaging**: Socket.IO chat between matched users
- ✅ **Consistent Navigation**: Seamless UI across all pages

## 🚀 Quick Start

### Prerequisites
- **Docker Desktop** (Windows/Mac) or Docker + Docker Compose (Linux)
- **Git**
- **8GB RAM minimum** (10GB recommended)

### Installation

```bash
# Clone the repository
git clone https://github.com/ravichavali/karmyq.git
cd karmyq

# Start all services
docker-compose up --build

# Wait for services to start (about 60-90 seconds on first run)
# You'll see "Ready in X.Xs" when frontend is ready
```

### Access the Platform

| Service | URL | Description |
|---------|-----|-------------|
| **Web App** | http://localhost:3000 | Main application |
| **Auth API** | http://localhost:3001 | Authentication service |
| **Community API** | http://localhost:3002 | Community management |
| **Request API** | http://localhost:3003 | Help requests & matching |
| **Reputation API** | http://localhost:3004 | Karma & trust scores |
| **Notification API** | http://localhost:3005 | Notification service |
| **Messaging API** | http://localhost:3006 | Real-time chat |
| **Redis Commander** | http://localhost:8081 | Event queue viewer |
| **PostgreSQL** | localhost:5432 | Database (user: `karmyq_user`, pass: `karmyq_password_dev`) |

### First Steps

1. Open http://localhost:3000
2. Click "Register" to create an account
3. Create or join a community
4. Post a help request or offer to help
5. Get matched and start messaging!

## 🏗️ Architecture

### Microservices

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Port 3000)                  │
│                    Next.js + React + Tailwind                │
└─────────────┬───────────────────────────────────────────────┘
              │
    ┌─────────┴─────────┐
    │   API Gateway     │  (Future: Centralized routing)
    └─────────┬─────────┘
              │
    ┌─────────┴──────────────────────────────────────────────┐
    │                  Microservices Layer                    │
    ├─────────────────────────────────────────────────────────┤
    │ Auth (3001)         │ Community (3002)  │ Request (3003)│
    │ Reputation (3004)   │ Notification (3005) │ Msg (3006)  │
    └─────────┬──────────────────────────────────────────────┘
              │
    ┌─────────┴─────────┐
    │   Data Layer      │
    ├───────────────────┤
    │ PostgreSQL (5432) │ ← 6 schemas (auth, communities, requests,
    │ Redis (6379)      │              reputation, notifications, messaging)
    └───────────────────┘
```

### Service Responsibilities

#### Auth Service (Port 3001)
- User registration with bcrypt password hashing
- JWT token generation and validation
- Session management
- User profile management

#### Community Service (Port 3002)
- Community CRUD operations
- Member invitations and management
- Community norms proposal and voting
- Dunbar's number enforcement (150 member limit)

#### Request/Matching Service (Port 3003)
- Help request creation with categories and urgency
- Help offer management
- Automatic request-offer matching algorithm
- Match lifecycle (proposed → active → completed/cancelled)

#### Reputation Service (Port 3004)
- Karma point tracking
- Trust score calculation (0-100 scale)
- Leaderboards and rankings
- Karma history and badges
- Event-driven karma awarding via Redis queue

#### Notification Service (Port 3005)
- 12 notification types (match_created, karma_awarded, etc.)
- Template-based notification system
- Server-Sent Events (SSE) for real-time delivery
- User notification preferences
- Push notification support (mobile ready)

#### Messaging Service (Port 3006)
- Real-time chat via Socket.IO
- Conversation management
- Typing indicators
- Read receipts
- Message history and search

### Database Schemas

```sql
-- 6 Independent Schemas in PostgreSQL
├── auth              -- Users, sessions
├── communities       -- Communities, members, norms, norm_approvals
├── requests          -- Help_requests, help_offers, request_matches
├── reputation        -- Karma_records, trust_scores, badges
├── notifications     -- Notifications, preferences, global_preferences
└── messaging         -- Conversations, messages, conversation_participants
```

### Event-Driven Communication

Services communicate via Redis/Bull queues:

```javascript
// Example: Match completed → Karma awarded
Request Service → Redis Queue → Reputation Service
                              → Notification Service
```

## 📱 Frontend Features

### Pages
- **Dashboard**: Overview of communities, requests, karma, and messages
- **Communities**: Browse, create, and join communities
- **Requests**: Post and browse help requests
- **Offers**: Create and view help offers
- **Messages**: Real-time chat with matched helpers
- **Notifications**: View all notifications with real-time updates

### UI/UX
- Responsive design with Tailwind CSS
- Consistent navigation with Layout component
- Real-time updates (Socket.IO + SSE)
- Loading states and error handling
- Mobile-friendly interface

## 🛠️ Technology Stack

### Backend
- **Runtime**: Node.js 20
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL 15
- **Queue**: Redis 7 + Bull
- **Real-time**: Socket.IO, Server-Sent Events

### Frontend
- **Framework**: Next.js 14
- **UI Library**: React 18
- **Styling**: Tailwind CSS 3
- **State Management**: React Context API
- **HTTP Client**: Axios
- **Real-time**: Socket.IO Client

### DevOps
- **Containerization**: Docker & Docker Compose
- **Development**: Hot reload for all services
- **Database Tools**: PostgreSQL client, Redis Commander

## 📖 API Documentation

### Auth Service

```bash
# Register
POST /auth/register
{
  "email": "user@example.com",
  "name": "John Doe",
  "password": "securepassword"
}

# Login
POST /auth/login
{
  "email": "user@example.com",
  "password": "securepassword"
}

# Verify Token
GET /auth/verify
Headers: Authorization: Bearer <token>
```

### Community Service

```bash
# Create Community
POST /communities
{
  "name": "Downtown Neighbors",
  "description": "Help each other in downtown area",
  "creator_id": "user-uuid",
  "max_members": 150
}

# Get Communities
GET /communities?status=active&limit=10

# Join Community
POST /communities/:id/members
{
  "user_id": "user-uuid",
  "invited_by": "inviter-uuid"
}
```

### Request Service

```bash
# Create Request
POST /requests
{
  "community_id": "community-uuid",
  "requester_id": "user-uuid",
  "title": "Need help moving furniture",
  "description": "Moving to new apartment, need 2 people",
  "type": "physical_help",
  "urgency": "high"
}

# Create Offer
POST /offers
{
  "community_id": "community-uuid",
  "offerer_id": "user-uuid",
  "title": "Can help with moving",
  "type": "physical_help"
}

# Respond to Request (Creates Match)
POST /requests/:id/respond
{
  "responder_id": "user-uuid",
  "offer_id": "offer-uuid"  // optional
}
```

### Messaging Service

```bash
# Get Conversations
GET /messages/conversations?user_id=user-uuid

# Get Messages
GET /messages/conversations/:id/messages

# Send Message (via Socket.IO)
socket.emit('send_message', {
  conversationId: 'conversation-uuid',
  senderId: 'user-uuid',
  content: 'Hello!'
})
```

## 🔧 Development

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f frontend
docker-compose logs -f auth-service
docker-compose logs -f messaging-service
```

### Restart Services

```bash
# Single service
docker-compose restart frontend

# All services
docker-compose restart

# Rebuild after code changes
docker-compose up -d --build auth-service
```

### Database Access

```bash
# Connect to PostgreSQL
docker exec -it karmyq-postgres psql -U karmyq_user -d karmyq_db

# View tables in a schema
\dt auth.*
\dt communities.*

# Example query
SELECT * FROM auth.users LIMIT 5;
```

### Redis Queue Monitoring

```bash
# Via Redis Commander
Open http://localhost:8081

# Via Redis CLI
docker exec -it karmyq-redis redis-cli
KEYS *
LRANGE bull:karmyq-events:wait 0 -1
```

### Stop & Clean

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (clears database)
docker-compose down -v

# Remove all containers and images
docker-compose down --rmi all -v
```

## 📊 Project Structure

```
karmyq/
├── services/                    # Microservices
│   ├── auth-service/           # User authentication
│   ├── community-service/      # Community management
│   ├── request-service/        # Help requests & matching
│   ├── reputation-service/     # Karma & trust scores
│   ├── notification-service/   # Real-time notifications
│   └── messaging-service/      # Real-time chat
├── frontend/                    # Next.js web application
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── contexts/           # React Context providers
│   │   ├── lib/                # API clients & utilities
│   │   └── pages/              # Next.js pages
│   └── public/                 # Static assets
├── infrastructure/              # Database & config
│   └── init.sql                # Database initialization
├── shared/                      # Shared TypeScript types
├── mobile/                      # Expo mobile app (future)
├── docs/                        # Documentation
└── docker-compose.yml          # Service orchestration
```

## 🧪 Testing

```bash
# Run tests for a service
cd services/auth-service
npm test

# Run with coverage
npm run test:coverage

# Integration tests (future)
npm run test:integration
```

## 🚢 Deployment

### Environment Variables

Create `.env` files for production:

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Redis
REDIS_URL=redis://host:6379

# JWT
JWT_SECRET=your-secure-secret-key

# Services
AUTH_SERVICE_URL=https://auth.karmyq.com
COMMUNITY_SERVICE_URL=https://community.karmyq.com
# ... etc
```

### Production Considerations

- [ ] Use managed PostgreSQL (AWS RDS, DigitalOcean, etc.)
- [ ] Use managed Redis (ElastiCache, Redis Cloud)
- [ ] Set up API Gateway (Kong, AWS API Gateway)
- [ ] Configure HTTPS with SSL certificates
- [ ] Set up monitoring (Datadog, New Relic)
- [ ] Implement rate limiting
- [ ] Set up backup and disaster recovery
- [ ] Configure CDN for static assets

## 🗺️ Roadmap

### Future Features
- [ ] Mobile app (React Native/Expo)
- [ ] Push notifications
- [ ] Email notifications
- [ ] Advanced search and filtering
- [ ] User profiles and avatars
- [ ] Image uploads for requests
- [ ] Community analytics dashboard
- [ ] Reputation badges system
- [ ] Recurring help requests
- [ ] Calendar integration
- [ ] Payment gateway (optional donations)

### Improvements
- [ ] API Gateway implementation
- [ ] GraphQL layer
- [ ] Comprehensive test coverage
- [ ] Load testing and optimization
- [ ] Security audit
- [ ] Accessibility improvements
- [ ] Internationalization (i18n)

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**: Follow existing code style
4. **Write tests**: Maintain test coverage
5. **Commit**: `git commit -m 'feat: add amazing feature'`
6. **Push**: `git push origin feature/amazing-feature`
7. **Open a Pull Request**

### Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `refactor:` Code refactoring
- `test:` Test additions/changes
- `chore:` Maintenance tasks

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Powered by [PostgreSQL](https://www.postgresql.org/)
- Real-time with [Socket.IO](https://socket.io/)
- Containerized with [Docker](https://www.docker.com/)

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/ravichavali/karmyq/issues)
- **Discussions**: [GitHub Discussions](https://github.com/ravichavali/karmyq/discussions)
- **Email**: support@karmyq.com (placeholder)

## 🌟 Star History

If you find Karmyq useful, please consider giving it a star ⭐ on GitHub!

---

**Built with ❤️ for communities helping communities**
