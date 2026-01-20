function TermsOfService() {
  return (
  <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 smooth-scroll no-mobile-anim">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-100 rounded-full mb-6">
              <svg className="w-10 h-10 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 mb-4">
              Terms of Service
            </h1>
            <p className="text-lg text-gray-600">
              For MSEC Academics Platform
            </p>
            <p className="text-lg text-gray-600">
              Last updated: October 20, 2025
            </p>
          </div>

          {/* Content */}
          <div className="glass-card no-mobile-backdrop p-8 rounded-3xl shadow-2xl space-y-8 mobile-smoothest-scroll">
          {/* Acceptance of Terms */}
          <section className="border-l-4 border-indigo-500 pl-4 sm:pl-6 bg-indigo-50 rounded-r-lg py-4 pr-4 sm:pr-6">
            <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-[#111418]">1. Acceptance of Terms</h2>
            <p className="text-sm sm:text-base text-[#60758a] leading-relaxed">
              By accessing and using MSEC Academics, you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to these terms, please do not use our platform.
            </p>
          </section>

          {/* User Accounts */}
          <section className="border-l-4 border-blue-500 pl-4 sm:pl-6">
            <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-[#111418]">2. User Accounts</h2>
            <div className="grid gap-3">
              <div className="flex items-start gap-3 bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
                <span className="text-xl">👤</span>
                <span className="text-sm sm:text-base text-[#60758a]">You must use your official MSEC email address to register</span>
              </div>
              <div className="flex items-start gap-3 bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
                <span className="text-xl">🔒</span>
                <span className="text-sm sm:text-base text-[#60758a]">You are responsible for maintaining the confidentiality of your account</span>
              </div>
              <div className="flex items-start gap-3 bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
                <span className="text-xl">⚠️</span>
                <span className="text-sm sm:text-base text-[#60758a]">You must notify us immediately of any unauthorized use</span>
              </div>
              <div className="flex items-start gap-3 bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
                <span className="text-xl">🚫</span>
                <span className="text-sm sm:text-base text-[#60758a]">You may not share your account with others</span>
              </div>
              <div className="flex items-start gap-3 bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
                <span className="text-xl">📌</span>
                <span className="text-sm sm:text-base text-[#60758a]">Accounts are personal and non-transferable</span>
              </div>
            </div>
          </section>

          {/* Booking Rules */}
          {/* Academic Rules */}
          <section className="border-l-4 border-green-500 pl-4 sm:pl-6">
            <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-[#111418]">3. Academic Rules and Guidelines</h2>
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 sm:p-5">
                <h3 className="text-lg sm:text-xl font-semibold mb-4 text-green-900 flex items-center gap-2">
                  <span>📋</span> General Rules
                </h3>
                <div className="grid gap-3">
                  <div className="flex items-start gap-3 bg-white p-3 rounded-lg">
                    <span className="text-green-600 font-bold">1.</span>
                    <span className="text-sm sm:text-base text-[#60758a]">Academic records must be kept accurate and up-to-date</span>
                  </div>
                  <div className="flex items-start gap-3 bg-white p-3 rounded-lg">
                    <span className="text-green-600 font-bold">2.</span>
                    <span className="text-sm sm:text-base text-[#60758a]">All grade changes require approval by authorized faculty</span>
                  </div>
                  <div className="flex items-start gap-3 bg-white p-3 rounded-lg">
                    <span className="text-green-600 font-bold">3.</span>
                    <span className="text-sm sm:text-base text-[#60758a]">Provide accurate information for transcripts and certificates</span>
                  </div>
                  <div className="flex items-start gap-3 bg-white p-3 rounded-lg">
                    <span className="text-green-600 font-bold">4.</span>
                    <span className="text-sm sm:text-base text-[#60758a]">Contact the academic office for any corrections or disputes</span>
                  </div>
                </div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 sm:p-5">
                <h3 className="text-lg sm:text-xl font-semibold mb-4 text-purple-900 flex items-center gap-2">
                  <span>⭐</span> Academic Priority System
                </h3>
                <div className="space-y-3">
                  <div className="bg-white p-4 rounded-lg border-l-4 border-purple-500">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-purple-100 text-purple-800 text-xs font-bold px-2 py-1 rounded">HIGHEST</span>
                      <span className="text-sm font-semibold text-purple-900">Principal & Secretary</span>
                    </div>
                    <p className="text-xs text-[#60758a]">Top priority for all academic decisions</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border-l-4 border-blue-400">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">HIGH</span>
                      <span className="text-sm font-semibold text-blue-900">Admin</span>
                    </div>
                    <p className="text-xs text-[#60758a]">Can override regular user requests</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border-l-4 border-gray-400">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-gray-100 text-gray-800 text-xs font-bold px-2 py-1 rounded">NORMAL</span>
                      <span className="text-sm font-semibold text-gray-900">Regular Users</span>
                    </div>
                    <p className="text-xs text-[#60758a]">Subject to higher priority overrides</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* User Conduct */}
          <section>
            <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">4. User Conduct</h2>
            <p className="text-sm sm:text-base text-[#60758a] leading-relaxed mb-3">
              Users agree NOT to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm sm:text-base text-[#60758a]">
              <li>Falsify academic records or grades</li>
              <li>Request transcripts for unauthorized purposes</li>
              <li>Damage or misuse academic resources</li>
              <li>Interfere with other users' academic access</li>
              <li>Violate any college rules or regulations</li>
              <li>Use the platform for commercial purposes without permission</li>
            </ul>
          </section>

          {/* Cancellations and Modifications */}
          <section>
            <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">5. Cancellations and Modifications</h2>
            <ul className="list-disc list-inside space-y-2 text-sm sm:text-base text-[#60758a]">
              <li>Users can request corrections to academic records through the platform</li>
              <li>Administrators reserve the right to modify or correct any record</li>
              <li>Academic reassignments may occur due to policy or priority decisions</li>
              <li>Users will be notified of any changes to their records</li>
            </ul>
          </section>

          {/* Venue Usage */}
          <section>
            <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">6. Venue Usage Responsibilities</h2>
            <ul className="list-disc list-inside space-y-2 text-sm sm:text-base text-[#60758a]">
              <li>Users must maintain academic integrity at all times</li>
              <li>Keep personal and academic information secure</li>
              <li>Report any errors or issues immediately</li>
              <li>Do not share confidential academic data</li>
              <li>Follow all safety and privacy regulations</li>
            </ul>
          </section>

          {/* Liability */}
          <section>
            <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">7. Limitation of Liability</h2>
            <p className="text-sm sm:text-base text-[#60758a] leading-relaxed">
              MSEC Academics is provided "as is" without warranties of any kind. We are not liable for any damages arising from the use or inability to use the platform, including but not limited to academic record errors, grade disputes, or service unavailability.
            </p>
          </section>

          {/* Intellectual Property */}
          <section>
            <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">8. Intellectual Property</h2>
            <p className="text-sm sm:text-base text-[#60758a] leading-relaxed">
              All content on MSEC Academics, including text, graphics, logos, and software, is the property of Meenakshi Sundararajan Engineering College and is protected by copyright and other intellectual property laws.
            </p>
          </section>

          {/* Termination */}
          <section>
            <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">9. Termination</h2>
            <p className="text-sm sm:text-base text-[#60758a] leading-relaxed">
              We reserve the right to suspend or terminate your account at any time for violations of these terms, fraudulent activity, or any other reason deemed appropriate by the administration.
            </p>
          </section>

          {/* Changes to Terms */}
          <section>
            <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">10. Changes to Terms</h2>
            <p className="text-sm sm:text-base text-[#60758a] leading-relaxed">
              We reserve the right to modify these terms at any time. Changes will be effective immediately upon posting. Continued use of the platform after changes constitutes acceptance of the modified terms.
            </p>
          </section>

          {/* Contact Information */}
          <section className="border-l-4 border-indigo-500 pl-4 sm:pl-6">
            <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-[#111418]">11. Contact Information</h2>
            <p className="text-sm sm:text-base text-[#60758a] leading-relaxed mb-4">
              For questions about these Terms of Service, contact us at:
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

export default TermsOfService
