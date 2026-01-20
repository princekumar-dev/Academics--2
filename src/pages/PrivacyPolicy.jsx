function PrivacyPolicy() {
  return (
  <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 smooth-scroll no-mobile-anim">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-6">
              <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 mb-4">
              Privacy Policy
            </h1>
            <p className="text-lg text-gray-600">
              Last updated: October 20, 2025
            </p>
          </div>

          {/* Content */}
          <div className="glass-card no-mobile-backdrop p-8 rounded-3xl shadow-2xl space-y-8 mobile-smoothest-scroll">
          {/* Introduction */}
          <section className="border-l-4 border-blue-500 pl-4 sm:pl-6">
            <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-[#111418]">1. Introduction</h2>
            <p className="text-sm sm:text-base text-[#60758a] leading-relaxed">
              MSEC Academics ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our academic platform.
            </p>
          </section>

          {/* Information We Collect */}
          <section className="border-l-4 border-green-500 pl-4 sm:pl-6">
            <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-[#111418]">2. Information We Collect</h2>
            <div className="space-y-4">
              <div className="bg-green-50 p-4 sm:p-5 rounded-xl">
                <h3 className="text-lg sm:text-xl font-semibold mb-2 text-green-900">Personal Information</h3>
                <ul className="list-disc list-inside space-y-2 text-sm sm:text-base text-[#60758a]">
                  <li>Name and email address</li>
                  <li>Role/designation (student, faculty, admin)</li>
                  <li>Contact information</li>
                  <li>Department information</li>
                </ul>
              </div>
              <div className="bg-blue-50 p-4 sm:p-5 rounded-xl">
                <h3 className="text-lg sm:text-xl font-semibold mb-2 text-blue-900">Academic Information</h3>
                <ul className="list-disc list-inside space-y-2 text-sm sm:text-base text-[#60758a]">
                  <li>Academic records and performance data</li>
                  <li>Course enrollments and grades</li>
                  <li>Attendance and participation records</li>
                  <li>Academic achievements and certifications</li>
                </ul>
              </div>
            </div>
          </section>

          {/* How We Use Your Information */}
          <section className="border-l-4 border-purple-500 pl-4 sm:pl-6">
            <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-[#111418]">3. How We Use Your Information</h2>
            <div className="bg-purple-50 p-4 sm:p-5 rounded-xl">
              <ul className="list-disc list-inside space-y-2 text-sm sm:text-base text-[#60758a]">
                <li>Manage academic records and student data</li>
                <li>Provide academic services and support</li>
                <li>Track academic progress and achievements</li>
                <li>Communicate with students and faculty</li>
                <li>Improve our platform and services</li>
                <li>Maintain security and prevent fraud</li>
              </ul>
            </div>
          </section>

          {/* Data Security */}
          <section className="border-l-4 border-orange-500 pl-4 sm:pl-6">
            <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-[#111418]">4. Data Security</h2>
            <p className="text-sm sm:text-base text-[#60758a] leading-relaxed">
              We implement appropriate technical and organizational security measures to protect your personal information. However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          {/* Data Retention */}
          <section className="border-l-4 border-red-500 pl-4 sm:pl-6">
            <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-[#111418]">5. Data Retention</h2>
            <p className="text-sm sm:text-base text-[#60758a] leading-relaxed">
              We retain your personal information for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required by law.
            </p>
          </section>

          {/* Your Rights */}
          <section className="border-l-4 border-indigo-500 pl-4 sm:pl-6">
            <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-[#111418]">6. Your Rights</h2>
            <div className="bg-indigo-50 p-4 sm:p-5 rounded-xl">
              <ul className="list-disc list-inside space-y-2 text-sm sm:text-base text-[#60758a]">
                <li>Access your personal information</li>
                <li>Correct inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Object to processing of your data</li>
                <li>Withdraw consent at any time</li>
              </ul>
            </div>
          </section>

          {/* Third-Party Services */}
          <section className="border-l-4 border-yellow-500 pl-4 sm:pl-6">
            <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-[#111418]">7. Third-Party Services</h2>
            <p className="text-sm sm:text-base text-[#60758a] leading-relaxed">
              We may use third-party services to help us operate our platform. These third parties have access to your personal information only to perform specific tasks on our behalf and are obligated not to disclose or use it for any other purpose.
            </p>
          </section>

          {/* Changes to Privacy Policy */}
          <section className="border-l-4 border-pink-500 pl-4 sm:pl-6">
            <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-[#111418]">8. Changes to This Privacy Policy</h2>
            <p className="text-sm sm:text-base text-[#60758a] leading-relaxed">
              We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
            </p>
          </section>

          {/* Contact Us */}
          <section className="border-l-4 border-blue-500 pl-4 sm:pl-6">
            <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-[#111418]">9. Contact Us</h2>
            <p className="text-sm sm:text-base text-[#60758a] leading-relaxed mb-4">
              If you have any questions about this Privacy Policy, please contact us at:
            </p>
            <div className="rounded-xl no-mobile-backdrop p-5 sm:p-6 shadow-lg bg-white/10 border border-white/10 backdrop-blur-md">
              <div className="flex items-center gap-3 mb-3">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-theme-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <p className="text-sm sm:text-base font-medium text-[#111418]">Email: support@msecacademics.edu</p>
              </div>
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-[#60758a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-sm sm:text-base font-medium text-[#111418]">
                  <span className="block sm:inline">Address: Meenakshi Sundararajan Engineering College</span>
                  <span className="block sm:inline">Chennai - 600 024</span>
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Back Button */}
        <div className="mt-8 sm:mt-12">
          <button
            onClick={() => window.history.back()}
            className="glass-button group font-semibold px-4 sm:px-6 py-2 sm:py-3 rounded-xl transition-all duration-300 flex items-center gap-2 text-sm sm:text-base text-blue-600"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to previous page
          </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PrivacyPolicy
