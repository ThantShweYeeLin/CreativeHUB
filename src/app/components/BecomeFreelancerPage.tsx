import { ChevronLeft, Camera, Upload, Sparkles, CheckCircle } from 'lucide-react';
import { useState } from 'react';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface BecomeFreelancerPageProps {
  onBack: () => void;
}

export function BecomeFreelancerPage({ onBack }: BecomeFreelancerPageProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    displayName: '',
    specialty: '',
    location: '',
    phone: '',
    email: '',
    bio: '',
    experience: '',
    hourlyRate: '',
    portfolio: [] as File[]
  });

  const specialties = [
    'Photographer',
    'Makeup Artist',
    'Model',
    'Videographer',
    'Hairstylist',
    'Fashion Designer',
    'Graphic Designer',
    'Video Editor'
  ];

  const handleSubmit = () => {
    // TODO: Submit freelancer application
    console.log('Submitting freelancer application:', formData);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 pb-12">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-200 mb-8">
        <div className="max-w-[1200px] mx-auto px-8 py-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-900 hover:text-black font-semibold mb-4 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            Back to Home
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Become a Freelancer</h1>
            <p className="text-gray-600">Join our creative community and start working on exciting projects</p>
          </div>
        </div>
      </div>

      <div className="max-w-[900px] mx-auto px-8">
        {/* Progress Steps */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 mb-8">
          <div className="flex items-center justify-between mb-8">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center flex-1">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center font-bold transition-all ${
                      currentStep >= step
                        ? 'bg-gradient-to-r from-gray-900 to-black text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {currentStep > step ? <CheckCircle className="w-6 h-6" /> : step}
                  </div>
                  <div>
                    <div className={`font-semibold ${currentStep >= step ? 'text-gray-900' : 'text-gray-500'}`}>
                      {step === 1 ? 'Basic Info' : step === 2 ? 'Professional Details' : 'Portfolio'}
                    </div>
                  </div>
                </div>
                {step < 3 && (
                  <div
                    className={`flex-1 h-1 mx-4 rounded-full ${
                      currentStep > step ? 'bg-gradient-to-r from-gray-900 to-black' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
          {currentStep === 1 && (
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Basic Information</h3>

              {/* Profile Picture Upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Profile Picture</label>
                <div className="flex items-center gap-6">
                  <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-200 ring-4 ring-gray-100">
                    <ImageWithFallback
                      src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200"
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-900 rounded-lg font-semibold hover:bg-gray-200 transition-colors">
                    <Camera className="w-5 h-5" />
                    Upload Photo
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Display Name</label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  placeholder="Enter your full name"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="your.email@example.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+66 123 456 789"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Bangkok, Thailand"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none transition-all"
                />
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Professional Details</h3>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Specialty</label>
                <div className="grid grid-cols-2 gap-3">
                  {specialties.map((specialty) => (
                    <button
                      key={specialty}
                      onClick={() => setFormData({ ...formData, specialty })}
                      className={`px-4 py-3 rounded-lg font-semibold transition-all ${
                        formData.specialty === specialty
                          ? 'bg-gradient-to-r from-gray-900 to-black text-white shadow-lg'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {specialty}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Bio</label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Tell us about yourself and your creative journey..."
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Years of Experience</label>
                <input
                  type="number"
                  value={formData.experience}
                  onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                  placeholder="5"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Hourly Rate (THB)</label>
                <input
                  type="number"
                  value={formData.hourlyRate}
                  onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                  placeholder="1500"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none transition-all"
                />
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Portfolio</h3>

              <div className="border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center hover:border-gray-500 transition-all cursor-pointer">
                <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-10 h-10 text-gray-900" />
                </div>
                <h4 className="text-xl font-bold text-gray-900 mb-2">Upload Your Portfolio</h4>
                <p className="text-gray-600 mb-4">Drag and drop images of your best work, or click to browse</p>
                <p className="text-sm text-gray-500">Support: JPG, PNG (Max 10 images)</p>
              </div>

              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6 border-2 border-gray-100">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-6 h-6 text-gray-900 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-gray-900 mb-2">Portfolio Tips</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• Upload your best and most recent work</li>
                      <li>• Show variety in your style and techniques</li>
                      <li>• Include before/after shots if applicable</li>
                      <li>• High-quality images get more attention</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              disabled={currentStep === 1}
              className="px-6 py-3 text-gray-700 font-semibold hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            {currentStep < 3 ? (
              <button
                onClick={() => setCurrentStep(currentStep + 1)}
                className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-gray-900 to-black text-white rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all"
              >
                Next Step
                <ChevronLeft className="w-5 h-5 rotate-180" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all"
              >
                <CheckCircle className="w-5 h-5" />
                Submit Application
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
