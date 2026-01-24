export function LoginSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="relative z-10 w-full max-w-md">
        <div className="backdrop-blur-md bg-white/20 border border-white/30 p-8 rounded-3xl shadow-2xl animate-pulse">
          {/* Icon skeleton */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/30 rounded-full mb-6"></div>
            <div className="h-9 bg-white/30 rounded-lg w-3/4 mx-auto mb-2"></div>
            <div className="h-6 bg-white/20 rounded-lg w-2/3 mx-auto"></div>
          </div>
          
          {/* Email field skeleton */}
          <div className="space-y-6">
            <div>
              <div className="h-4 bg-white/30 rounded w-24 mb-3"></div>
              <div className="h-14 bg-white/20 rounded-2xl"></div>
            </div>
            
            {/* Password field skeleton */}
            <div>
              <div className="h-4 bg-white/30 rounded w-20 mb-3"></div>
              <div className="h-14 bg-white/20 rounded-2xl"></div>
            </div>
            
            {/* Forgot password skeleton */}
            <div className="text-center">
              <div className="h-4 bg-white/20 rounded w-32 mx-auto"></div>
            </div>
            
            {/* Button skeleton */}
            <div className="pt-4">
              <div className="h-14 bg-white/30 rounded-2xl"></div>
            </div>
          </div>
          
          {/* Sign up link skeleton */}
          <div className="mt-8 text-center">
            <div className="h-4 bg-white/20 rounded w-48 mx-auto"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function SignUpSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="relative z-10 w-full max-w-md">
        <div className="backdrop-blur-md bg-white/20 border border-white/30 p-8 rounded-3xl shadow-2xl animate-pulse">
          {/* Icon skeleton */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/30 rounded-full mb-6"></div>
            <div className="h-9 bg-white/30 rounded-lg w-3/4 mx-auto mb-2"></div>
            <div className="h-6 bg-white/20 rounded-lg w-2/3 mx-auto"></div>
          </div>
          
          {/* Form fields skeleton */}
          <div className="space-y-6">
            {/* Name, Email fields */}
            {[1, 2].map((i) => (
              <div key={i}>
                <div className="h-4 bg-white/30 rounded w-24 mb-3"></div>
                <div className="h-14 bg-white/20 rounded-2xl"></div>
              </div>
            ))}
            
            {/* Role and Department selects */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="h-4 bg-white/30 rounded w-16 mb-3"></div>
                <div className="h-14 bg-white/20 rounded-2xl"></div>
              </div>
              <div>
                <div className="h-4 bg-white/30 rounded w-20 mb-3"></div>
                <div className="h-14 bg-white/20 rounded-2xl"></div>
              </div>
            </div>
            
            {/* Year & Section grid skeleton */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="h-4 bg-white/30 rounded w-16 mb-3"></div>
                <div className="h-14 bg-white/20 rounded-2xl"></div>
              </div>
              <div>
                <div className="h-4 bg-white/30 rounded w-16 mb-3"></div>
                <div className="h-14 bg-white/20 rounded-2xl"></div>
              </div>
            </div>
            
            {/* Password fields */}
            {[1, 2].map((i) => (
              <div key={`pass-${i}`}>
                <div className="h-4 bg-white/30 rounded w-28 mb-3"></div>
                <div className="h-14 bg-white/20 rounded-2xl"></div>
              </div>
            ))}
            
            {/* Button skeleton */}
            <div className="pt-4">
              <div className="h-14 bg-white/30 rounded-2xl"></div>
            </div>
          </div>
          
          {/* Sign in link skeleton */}
          <div className="mt-8 text-center">
            <div className="h-4 bg-white/20 rounded w-48 mx-auto"></div>
          </div>
        </div>
      </div>
    </div>
  )
}
