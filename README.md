<div align="center">

# 🎓 MSEC Academics

### Academic Management System — marksheets, approvals & WhatsApp dispatch

[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://expressjs.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](#-license)

**[🔗 Live App](https://msec-academics.vercel.app)**

</div>

![MSEC Logo](public/images/mseclogo.png)

## 🎓 Overview

**MSEC Academics** is a comprehensive web-based academic management system designed specifically for Meenakshi Sundararajan Engineering College (MSEC). The platform streamlines the process of marksheet generation, verification, approval, and dispatch through an intuitive interface for staff and department heads.

## ✨ Features

### 📊 Marksheet Management
- **Excel Import**: Bulk import student marks from Excel files
- **Automated Marksheet Generation**: Create professional marksheets with student details and grades
- **PDF Generation**: Generate high-quality PDF marksheets with signatures
- **Marksheet Verification**: Staff verification workflow with digital signatures
- **Status Tracking**: Real-time tracking of marksheet status through the approval pipeline

### 🔐 Role-Based Access Control
- **Staff Users**: Import marks, generate marksheets, request dispatch
- **HOD (Head of Department)**: Approve/reject dispatch requests, view department overview
- **Secure Authentication**: JWT-based authentication system
- **Department-Specific Access**: Users restricted to their respective departments

### 📱 WhatsApp Integration
- **Automated Dispatch**: Send marksheet notifications via WhatsApp
- **Bulk Messaging**: Send notifications to multiple parents/students
- **Status Updates**: Track delivery status of WhatsApp messages
- **Template Messages**: Pre-formatted messages with student details

### 📈 Analytics & Reporting
- **Department Overview**: Comprehensive view of all marksheets in a department
- **Approval Statistics**: Track pending, approved, and dispatched marksheets
- **Export Reports**: Generate and export department-wise reports
- **Dashboard Analytics**: Real-time statistics and recent activity

### 🎨 Modern UI/UX
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Glass Morphism Design**: Modern aesthetic with backdrop blur effects
- **Intuitive Navigation**: Clean, user-friendly interface
- **Real-time Updates**: Live status updates without page refresh

## 🛠️ Technology Stack

### Frontend
- **React 18**: Modern component-based UI library with hooks
- **Vite**: Lightning-fast build tool and development server
- **React Router**: Client-side routing for single-page application
- **Tailwind CSS**: Utility-first CSS framework for responsive design
- **Axios**: HTTP client for API communication

### Backend
- **Node.js**: Server-side JavaScript runtime
- **Express.js**: Fast, unopinionated web framework
- **MongoDB**: NoSQL database for flexible data storage
- **Mongoose**: MongoDB object modeling for Node.js
- **JWT**: JSON Web Tokens for secure authentication
- **bcryptjs**: Password hashing for security

### Libraries & Tools
- **ExcelJS**: Excel file processing and generation
- **PDFKit**: PDF document generation
- **Evolution API**: WhatsApp messaging bridge
- **Cloudinary**: Image & media storage
- **Web Push (VAPID)**: Browser push notifications
- **Multer**: File upload handling
- **CORS**: Cross-origin resource sharing
- **Dotenv**: Environment variable management

## 🏗️ Architecture

```
MSEC Academics/
├── Frontend (React + Vite) - Port 3000
│   ├── Components (Header, Settings, ErrorBoundary)
│   ├── Pages (Home, Login, Marksheets, ImportMarks, etc.)
│   ├── Utils (Notifications, Authentication)
│   └── Assets (Images, Icons)
│
├── Backend (Node.js + Express) - Port 3001
│   ├── API Routes (/api/auth, /api/marksheets, /api/import-excel)
│   ├── Models (User, Student, Marksheet, ImportSession)
│   ├── Middleware (Authentication, File Upload)
│   └── Services (PDF Generation, WhatsApp Dispatch)
│
└── Database (MongoDB Atlas)
    ├── Users Collection
    ├── Students Collection
    ├── Marksheets Collection
    └── ImportSessions Collection
```

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v16 or higher)
- **npm** or **yarn** package manager
- **MongoDB Atlas** account (or local MongoDB installation)
- **Twilio** account for WhatsApp integration (optional)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/princekumar-dev/Academics--2.git
   cd Academics--2
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Copy the sample env file and fill in your own values:
   ```bash
   cp .env.example .env
   ```
   ```env
   # Server
   PORT=3001
   NODE_ENV=development
   PUBLIC_BASE_URL=http://localhost:3000

   # Database
   MONGODB_URI=your-mongodb-connection-string

   # Auth
   JWT_SECRET=your-super-secure-jwt-secret-key

   # WhatsApp (Evolution API bridge)
   EVOLUTION_API_URL=your-evolution-api-url
   EVOLUTION_API_KEY=your-evolution-api-key
   EVOLUTION_INSTANCE_NAME=your-instance-name

   # Cloudinary (image storage)
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret

   # Web push notifications
   VAPID_PUBLIC_KEY=your-vapid-public-key
   VAPID_PRIVATE_KEY=your-vapid-private-key
   ```

4. **Seed initial data** (optional)
   ```bash
   npm run seed-users
   ```

5. **Start the development servers**

   **Backend Server:**
   ```bash
   npm run server
   ```

   **Frontend Development Server:**
   ```bash
   npm run dev
   ```

   **Or run both simultaneously:**
   ```bash
   npm run dev:full
   ```

6. **Access the application**
   - Frontend: `http://localhost:3000`
   - Backend API: `http://localhost:3001`

## 📁 Project Structure

```
src/
├── components/
│   ├── ErrorBoundary.jsx          # Error handling component
│   ├── Header.jsx                 # Navigation header
│   ├── NotificationModal.jsx      # Notification display
│   ├── Settings.jsx               # User settings panel
│   └── Skeleton.jsx               # Loading skeleton
├── pages/
│   ├── Home.jsx                   # Dashboard with stats
│   ├── Login.jsx                  # Authentication page
│   ├── SignUp.jsx                 # User registration
│   ├── ImportMarks.jsx            # Excel import interface
│   ├── Marksheets.jsx             # Marksheet listing
│   ├── MarksheetDetails.jsx       # Individual marksheet view
│   ├── DispatchRequests.jsx       # Staff dispatch requests
│   ├── ApprovalRequests.jsx       # HOD approval interface
│   ├── DepartmentOverview.jsx     # Department-wide view
│   ├── Reports.jsx                # Report generation
│   ├── Records.jsx                # Historical records
│   ├── Contact.jsx                # Contact information
│   ├── PrivacyPolicy.jsx          # Privacy policy
│   ├── TermsOfService.jsx         # Terms of service
│   ├── FAQ.jsx                    # Frequently asked questions
│   └── NotFound.jsx               # 404 error page
├── utils/
│   ├── notifications.js           # Notification utilities
│   └── notification-switcher.js   # Notification management
├── App.jsx                        # Main application component
├── main.jsx                       # Application entry point
└── index.css                      # Global styles

api/
├── auth.js                        # Authentication endpoints
├── users.js                       # User management
├── marksheets.js                  # Marksheet CRUD operations
├── import-excel.js                # Excel import handling
├── generate-pdf.js                # PDF generation + report export
├── whatsapp-dispatch.js           # WhatsApp messaging
├── notifications.js               # Notification management
├── demo-excel.js                  # Demo Excel generation
└── examinations.js                # Examination management

lib/
├── mongo.js                       # MongoDB connection
├── notificationService.js         # Notification service
└── subscriptionManager.js         # Subscription management

scripts/
├── make-demo-excel.js             # Generate demo Excel files
└── show-samples.js                # Display sample data

models.js                          # Database models
server.js                          # Express server setup
```

## 👥 User Roles & Permissions

### 👨‍🏫 Staff Users
- Import student marks from Excel files
- Generate and verify marksheets
- Add digital signatures to marksheets
- Request dispatch approval from HOD
- View personal marksheet statistics
- Track dispatch status

### 🏫 Head of Department (HOD)
- Approve or reject dispatch requests
- View all department marksheets
- Generate department reports
- Reschedule dispatch dates
- Monitor department performance
- Access comprehensive analytics

## 🌟 Key Features & Workflows

### 📥 Excel Import Process
1. **Upload Excel File**: Staff uploads formatted Excel file with student marks
2. **Data Validation**: System validates data format and completeness
3. **Preview & Confirm**: Review imported data before processing
4. **Marksheet Generation**: Automatic creation of individual marksheets

### 🔄 Approval Workflow
1. **Draft**: Initial marksheet creation
2. **Verified by Staff**: Staff verification with signature
3. **Dispatch Requested**: Staff requests HOD approval
4. **HOD Review**: HOD approves/rejects or reschedules
5. **Approved by HOD**: Ready for dispatch
6. **Dispatched**: WhatsApp notification sent to parents

### 📱 WhatsApp Dispatch
- **Individual Messages**: Send marksheet links to specific students
- **Bulk Messages**: Send notifications to entire classes
- **Status Tracking**: Monitor delivery and read status
- **Template Customization**: Pre-formatted messages with student details

## 📊 Database Schema

### User Model
```javascript
{
  email: String (unique),
  password: String (hashed),
  role: 'staff' | 'hod',
  name: String,
   department: 'CSE' | 'AI_DS' | 'ECE' | 'MECH' | 'CIVIL' | 'EEE' | 'HNS',
  year: String, // Staff only
  section: String, // Staff only
  eSignature: String, // Base64 encoded
  phoneNumber: String,
  createdAt: Date
}
```

### Student Model
```javascript
{
  name: String,
  regNumber: String (unique),
  year: String,
  section: String,
  department: String,
  parentPhoneNumber: String,
  examinationName: String,
  examinationDate: Date,
  createdAt: Date
}
```

### Marksheet Model
```javascript
{
  marksheetId: String (unique),
  studentId: ObjectId (ref: Student),
  studentDetails: Object,
  examinationName: String,
  examinationDate: Date,
  semester: String,
  subjects: [{
    subjectName: String,
    marks: Number,
    grade: String
  }],
  overallGrade: String,
  staffId: ObjectId (ref: User),
  staffName: String,
  staffSignature: String,
  hodId: ObjectId (ref: User),
  hodName: String,
  hodSignature: String,
  principalSignature: String,
  status: 'draft' | 'verified_by_staff' | 'dispatch_requested' |
          'rescheduled_by_hod' | 'approved_by_hod' | 'rejected_by_hod' | 'dispatched',
  dispatchRequest: Object,
  dispatchStatus: Object,
  visited: Boolean,
  visitedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

## 🔧 API Documentation

### Authentication Endpoints
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/verify` - Verify JWT token

### Marksheet Endpoints
- `GET /api/marksheets` - Get marksheets (filtered by user role)
- `POST /api/marksheets` - Create new marksheet
- `PUT /api/marksheets/:id` - Update marksheet
- `DELETE /api/marksheets/:id` - Delete marksheet
- `GET /api/marksheets/:id` - Get specific marksheet

### Import Endpoints
- `POST /api/import-excel` - Import marks from Excel
- `GET /api/demo-excel` - Download demo Excel template

### Dispatch Endpoints
- `POST /api/whatsapp-dispatch/send-marksheet` - Send individual marksheet
- `POST /api/whatsapp-dispatch/send-bulk` - Send bulk notifications

### Report Endpoints
- `POST /api/generate-pdf` - Generate marksheets, leave letters, and department report exports

## 📋 Scripts & Commands

```bash
# Development
npm run dev              # Start frontend dev server
npm run server           # Start backend server
npm run dev:full         # Start both frontend and backend

# Build & Deploy
npm run build            # Build for production
npm run preview          # Preview production build

# Database
npm run seed-users       # Seed initial user data

# Utilities
npm run clean            # Clean dist directory
npm run warm-tunnel      # Warm up tunnel connection
```

## 🚀 Deployment

### Production Deployment
1. **Build the frontend**
   ```bash
   npm run build
   ```

2. **Environment Variables**
   Set production environment variables in your hosting platform

3. **Database**
   Ensure MongoDB Atlas connection string is configured

4. **Deploy Options**
   - **Vercel**: Frontend deployment with serverless functions
   - **Railway/Heroku**: Full-stack deployment
   - **Docker**: Containerized deployment

### Environment Variables (Production)
```env
NODE_ENV=production
MONGODB_URI=production-connection-string
JWT_SECRET=secure-production-jwt-secret
PUBLIC_BASE_URL=https://msec-academics.vercel.app
EVOLUTION_API_URL=production-evolution-url
EVOLUTION_API_KEY=production-evolution-key
EVOLUTION_INSTANCE_NAME=production-instance
```

### Enabling compressed build artifacts in CI (Brotli/Gzip)

The repository disables the `vite-plugin-compression` plugin on Windows to avoid path issues during local development. To enable generation of `.br` and `.gz` artifacts in CI (recommended for serving pre-compressed assets), set the environment variable `ENABLE_COMPRESSION=true` in your CI environment before running the build.

Examples:

- GitHub Actions (Linux runner):
   ```yaml
   - name: Build frontend
      run: ENABLE_COMPRESSION=true npm run build
   ```

- GitLab CI:
   ```yaml
   build_frontend:
      image: node:18
      script:
         - ENABLE_COMPRESSION=true npm ci
         - ENABLE_COMPRESSION=true npm run build
   ```

- Vercel / Netlify: add an environment variable named `ENABLE_COMPRESSION` with value `true` in the project settings, and ensure your build command runs `npm run build`.

Note: The `vite.config.js` only enables compression when `ENABLE_COMPRESSION=true` and the runner platform is not Windows. This keeps local Windows builds fast and avoids `.br`/`.gz` file path issues.

## 🤝 Contributing

We welcome contributions to improve MSEC Academics!

1. **Fork the repository**
2. **Create a feature branch**: `git checkout - b feature/amazing-feature`
3. **Commit your changes**: `git commit -m 'Add amazing feature'`
4. **Push to the branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

### Development Guidelines
- Follow existing code style and structure
- Add proper error handling
- Update documentation for new features
- Test thoroughly before submitting PR

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙋‍♂️ Support & Contact

### Technical Support
- **Developer**: Prince Kumar
- **GitHub**: [@princekumar-dev](https://github.com/princekumar-dev)
- **Email**: Contact through the application's contact page

### Institution Contact
- **Mohamed Sathak Engineering College**
- **Website**: [https://msec.edu.in](https://msec.edu.in)
- **Location**: Chennai, Tamil Nadu, India

## 🏆 Acknowledgments

- **Mohamed Sathak Engineering College** for institutional support
- **React Community** for the excellent framework
- **MongoDB** for the flexible database solution
- **Evolution API** for WhatsApp messaging capabilities
- **Tailwind CSS** for the utility-first CSS framework
- **Vite** for the lightning-fast development experience

---

**Built with ❤️ for MSEC Community**

*MSEC Academics - Empowering Education Through Technology*
