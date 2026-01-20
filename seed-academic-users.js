import { connectToDatabase } from './lib/mongo.js'
import { User } from './models.js'
import bcrypt from 'bcryptjs'

const academicUsers = [
  // HODs for each department
  {
    name: 'Dr. Rajesh Kumar',
    email: 'hod.cse@msec.edu.in',
    password: 'hod123',
    role: 'hod',
    department: 'CSE',
    phoneNumber: '+91-9876543210'
  },
  {
    name: 'Dr. Priya Sharma',
    email: 'hod.ece@msec.edu.in',
    password: 'hod123',
    role: 'hod',
    department: 'ECE',
    phoneNumber: '+91-9876543211'
  },
  {
    name: 'Dr. Amit Patel',
    email: 'hod.mech@msec.edu.in',
    password: 'hod123',
    role: 'hod',
    department: 'MECH',
    phoneNumber: '+91-9876543212'
  },
  {
    name: 'Dr. Sunita Reddy',
    email: 'hod.civil@msec.edu.in',
    password: 'hod123',
    role: 'hod',
    department: 'CIVIL',
    phoneNumber: '+91-9876543213'
  },
  {
    name: 'Dr. Vikram Singh',
    email: 'hod.eee@msec.edu.in',
    password: 'hod123',
    role: 'hod',
    department: 'EEE',
    phoneNumber: '+91-9876543214'
  },
  {
    name: 'Dr. Latha Narayanan',
    email: 'hod.hns@msec.edu.in',
    password: 'hod123',
    role: 'hod',
    department: 'HNS',
    phoneNumber: '+91-9876543230'
  },
  
  // Staff members for CSE department
  {
    name: 'Prof. Anita Desai',
    email: 'anita.desai@msec.edu.in',
    password: 'staff123',
    role: 'staff',
    department: 'CSE',
    class: 'A',
    phoneNumber: '+91-9876543215'
  },
  {
    name: 'Prof. Ramesh Gupta',
    email: 'ramesh.gupta@msec.edu.in',
    password: 'staff123',
    role: 'staff',
    department: 'CSE',
    class: 'B',
    phoneNumber: '+91-9876543216'
  },
  
  // Staff members for ECE department
  {
    name: 'Prof. Meera Joshi',
    email: 'meera.joshi@msec.edu.in',
    password: 'staff123',
    role: 'staff',
    department: 'ECE',
    class: 'A',
    phoneNumber: '+91-9876543217'
  },
  {
    name: 'Prof. Suresh Kumar',
    email: 'suresh.kumar@msec.edu.in',
    password: 'staff123',
    role: 'staff',
    department: 'ECE',
    class: 'B',
    phoneNumber: '+91-9876543218'
  },
  
  // Staff members for MECH department
  {
    name: 'Prof. Kavitha Nair',
    email: 'kavitha.nair@msec.edu.in',
    password: 'staff123',
    role: 'staff',
    department: 'MECH',
    class: 'A',
    phoneNumber: '+91-9876543219'
  },
  {
    name: 'Prof. Ravi Krishnan',
    email: 'ravi.krishnan@msec.edu.in',
    password: 'staff123',
    role: 'staff',
    department: 'MECH',
    class: 'B',
    phoneNumber: '+91-9876543220'
  },
  
  // Staff members for CIVIL department
  {
    name: 'Prof. Deepa Mehta',
    email: 'deepa.mehta@msec.edu.in',
    password: 'staff123',
    role: 'staff',
    department: 'CIVIL',
    class: 'A',
    phoneNumber: '+91-9876543221'
  },
  {
    name: 'Prof. Arun Verma',
    email: 'arun.verma@msec.edu.in',
    password: 'staff123',
    role: 'staff',
    department: 'CIVIL',
    class: 'B',
    phoneNumber: '+91-9876543222'
  },
  
  // Staff members for EEE department
  {
    name: 'Prof. Lakshmi Pillai',
    email: 'lakshmi.pillai@msec.edu.in',
    password: 'staff123',
    role: 'staff',
    department: 'EEE',
    class: 'A',
    phoneNumber: '+91-9876543223'
  },
  {
    name: 'Prof. Manoj Tiwari',
    email: 'manoj.tiwari@msec.edu.in',
    password: 'staff123',
    role: 'staff',
    department: 'EEE',
    class: 'B',
    phoneNumber: '+91-9876543224'
  }
  ,
  {
    name: 'Prof. Maya Krishnan',
    email: 'maya.krishnan@msec.edu.in',
    password: 'staff123',
    role: 'staff',
    department: 'HNS',
    class: 'A',
    phoneNumber: '+91-9876543231'
  },
  {
    name: 'Prof. S. Ramesh',
    email: 's.ramesh@msec.edu.in',
    password: 'staff123',
    role: 'staff',
    department: 'HNS',
    class: 'B',
    phoneNumber: '+91-9876543232'
  }
]

async function seedAcademicUsers() {
  try {
    console.log('🔄 Connecting to database...')
    await connectToDatabase()
    
    console.log('🧹 Clearing existing users in msec_academics database...')
    // Clear all users in the msec_academics database (since it's a separate database)
    await User.deleteMany({})
    
    console.log('🌱 Seeding academic users...')
    
    for (const userData of academicUsers) {
      const hashedPassword = await bcrypt.hash(userData.password, 10)
      const user = new User({
        ...userData,
        password: hashedPassword
      })
      await user.save()
      console.log(`✅ Created ${userData.role}: ${userData.name} (${userData.department}${userData.class ? ' - Class ' + userData.class : ''})`)
    }
    
    console.log('\n🎉 Successfully seeded academic users!')
    console.log('\n📧 Login Credentials:')
    console.log('HODs:')
    academicUsers.filter(u => u.role === 'hod').forEach(user => {
      console.log(`  ${user.department} HOD: ${user.email} / ${user.password}`)
    })
    console.log('\nStaff:')
    academicUsers.filter(u => u.role === 'staff').forEach(user => {
      console.log(`  ${user.department} Class ${user.class}: ${user.email} / ${user.password}`)
    })
    
    process.exit(0)
  } catch (error) {
    console.error('❌ Error seeding users:', error)
    process.exit(1)
  }
}

seedAcademicUsers()
