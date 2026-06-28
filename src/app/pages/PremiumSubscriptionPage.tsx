import { ChevronLeft, Shield, Clock, Award, RefreshCw, FileText, Headphones, Tag, Star, Check, X, Sparkles, Crown } from 'lucide-react';
import { useState } from 'react';

interface PremiumSubscriptionPageProps {
  onBack: () => void;
}

const premiumFeatures = [
  {
    icon: Shield,
    title: 'Secure Deposit Protection',
    description: 'Freelancers set deposit amounts for projects. Your payment is protected.',
    premium: true
  },
  {
    icon: RefreshCw,
    title: 'Refundable Deposits',
    description: 'Get your deposit back if service issues occur or expectations aren\'t met.',
    premium: true
  },
  {
    icon: FileText,
    title: 'Evidence Submission',
    description: 'Submit evidence for disputes with 24/7 mediation support.',
    premium: true
  },
  {
    icon: Award,
    title: 'Instant Replacement',
    description: 'If a freelancer cancels, we instantly find you a replacement at no extra cost.',
    premium: true
  },
  {
    icon: Headphones,
    title: 'Priority Support 24/7',
    description: 'Skip the queue with dedicated premium support agents available anytime.',
    premium: true
  },
  {
    icon: Tag,
    title: 'Exclusive Discounts',
    description: 'Access member-only pricing and seasonal offers from top freelancers.',
    premium: true
  },
  {
    icon: Star,
    title: 'Priority Booking',
    description: 'Get first access to book in-demand freelancers before anyone else.',
    premium: true
  }
];

export function PremiumSubscriptionPage({ onBack }: PremiumSubscriptionPageProps) {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-lg border-b border-gray-200">
        <div className="max-w-[600px] mx-auto px-4 py-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-900 hover:text-black font-semibold transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>
        </div>
      </div>

      <div className="max-w-[600px] mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-gray-900 to-black rounded-3xl mb-4 shadow-2xl">
            <Crown className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">CreativeHUB AI Premium</h1>
          <p className="text-gray-600 text-lg">Elevate your creative projects with protection and priority</p>
        </div>

        {/* Pricing Plans */}
        <div className="mb-8 space-y-3">
          {/* Annual Plan */}
          <button
            onClick={() => setSelectedPlan('annual')}
            className={`w-full relative overflow-hidden rounded-2xl transition-all ${
              selectedPlan === 'annual'
                ? 'bg-gradient-to-br from-gray-900 to-black text-white shadow-2xl scale-[1.02]'
                : 'bg-white border-2 border-gray-200 text-gray-900 hover:border-gray-300'
            }`}
          >
            {selectedPlan === 'annual' && (
              <div className="absolute top-4 right-4">
                <div className="flex items-center gap-1 bg-white text-gray-900 px-3 py-1 rounded-full text-xs font-bold">
                  <Sparkles className="w-3 h-3" />
                  Best Value
                </div>
              </div>
            )}
            <div className="p-6 text-left">
              <div className="mb-4">
                <h3 className={`text-xl font-bold mb-1 ${selectedPlan === 'annual' ? 'text-white' : 'text-gray-900'}`}>
                  Annual Plan
                </h3>
                <p className={`text-sm ${selectedPlan === 'annual' ? 'text-gray-300' : 'text-gray-500'}`}>
                  Save ฿189/year • Only ฿83/month
                </p>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold">฿999</span>
                <span className={`text-lg ${selectedPlan === 'annual' ? 'text-gray-300' : 'text-gray-500'}`}>/year</span>
              </div>
              {selectedPlan === 'annual' && (
                <div className="mt-4 flex items-center gap-2 text-sm">
                  <Check className="w-5 h-5 flex-shrink-0" />
                  <span>Selected</span>
                </div>
              )}
            </div>
          </button>

          {/* Monthly Plan */}
          <button
            onClick={() => setSelectedPlan('monthly')}
            className={`w-full relative overflow-hidden rounded-2xl transition-all ${
              selectedPlan === 'monthly'
                ? 'bg-gradient-to-br from-gray-900 to-black text-white shadow-2xl scale-[1.02]'
                : 'bg-white border-2 border-gray-200 text-gray-900 hover:border-gray-300'
            }`}
          >
            <div className="p-6 text-left">
              <div className="mb-4">
                <h3 className={`text-xl font-bold mb-1 ${selectedPlan === 'monthly' ? 'text-white' : 'text-gray-900'}`}>
                  Monthly Plan
                </h3>
                <p className={`text-sm ${selectedPlan === 'monthly' ? 'text-gray-300' : 'text-gray-500'}`}>
                  Flexible monthly billing
                </p>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold">฿99</span>
                <span className={`text-lg ${selectedPlan === 'monthly' ? 'text-gray-300' : 'text-gray-500'}`}>/month</span>
              </div>
              {selectedPlan === 'monthly' && (
                <div className="mt-4 flex items-center gap-2 text-sm">
                  <Check className="w-5 h-5 flex-shrink-0" />
                  <span>Selected</span>
                </div>
              )}
            </div>
          </button>
        </div>

        {/* Premium Features */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Shield className="w-6 h-6" />
            Premium Features
          </h2>
          <div className="space-y-5">
            {premiumFeatures.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div key={index} className="flex gap-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Icon className="w-6 h-6 text-gray-900" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">{feature.title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Comparison Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mb-8">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Free vs Premium</h2>
            {/* Column Headers */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-100 rounded-xl p-3 text-center border border-gray-200">
                <span className="text-sm font-bold text-gray-900">Free</span>
              </div>
              <div className="bg-gradient-to-br from-gray-900 to-black rounded-xl p-3 text-center">
                <span className="text-sm font-bold text-white">Premium</span>
              </div>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {/* Feature Row */}
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="font-semibold text-gray-900">Book Freelancers</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-200">
                  <Check className="w-5 h-5 text-gray-400 mx-auto mb-2" />
                  <div className="text-xs text-gray-600">Standard</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-900">
                  <Check className="w-5 h-5 text-gray-900 mx-auto mb-2" />
                  <div className="text-xs text-gray-900 font-semibold">Priority Access</div>
                </div>
              </div>
            </div>

            {/* Deposit Booking */}
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="font-semibold text-gray-900">Booking Requirements</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-200">
                  <Check className="w-5 h-5 text-gray-400 mx-auto mb-2" />
                  <div className="text-xs text-gray-600">No Deposit Needed</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-900">
                  <Check className="w-5 h-5 text-gray-900 mx-auto mb-2" />
                  <div className="text-xs text-gray-900 font-semibold">Deposit Required</div>
                </div>
              </div>
            </div>

            {/* Deposit Protection */}
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="font-semibold text-gray-900">Deposit Protection</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-200">
                  <X className="w-5 h-5 text-gray-300 mx-auto mb-2" />
                  <div className="text-xs text-gray-500">Not Available</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-900">
                  <Check className="w-5 h-5 text-gray-900 mx-auto mb-2" />
                  <div className="text-xs text-gray-900 font-semibold">Full Protection</div>
                </div>
              </div>
            </div>

            {/* Replacement Service */}
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="font-semibold text-gray-900">Instant Replacement</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-200">
                  <X className="w-5 h-5 text-gray-300 mx-auto mb-2" />
                  <div className="text-xs text-gray-500">Not Available</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-900">
                  <Check className="w-5 h-5 text-gray-900 mx-auto mb-2" />
                  <div className="text-xs text-gray-900 font-semibold">Guaranteed</div>
                </div>
              </div>
            </div>

            {/* Customer Support */}
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="font-semibold text-gray-900">Customer Support</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-200">
                  <Check className="w-5 h-5 text-gray-400 mx-auto mb-2" />
                  <div className="text-xs text-gray-600">9 AM - 4 PM</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-900">
                  <Check className="w-5 h-5 text-gray-900 mx-auto mb-2" />
                  <div className="text-xs text-gray-900 font-semibold">24/7 Priority</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Trust Badge */}
        <div className="bg-gradient-to-r from-gray-100 to-gray-200 rounded-2xl p-6 text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Shield className="w-6 h-6 text-gray-900" />
            <span className="font-bold text-gray-900 text-lg">100% Secure</span>
          </div>
          <p className="text-sm text-gray-700 max-w-sm mx-auto leading-relaxed">
            Cancel anytime. No hidden fees. Your subscription includes full deposit protection and priority support.
          </p>
        </div>

        {/* CTA Button */}
        <button className="w-full bg-gradient-to-r from-gray-900 to-black text-white py-5 rounded-2xl font-bold text-lg shadow-2xl hover:shadow-3xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2">
          <Crown className="w-6 h-6" />
          Upgrade to Premium
          <span className="text-sm font-normal">
            {selectedPlan === 'annual' ? '฿999/year' : '฿99/month'}
          </span>
        </button>

        {/* Footer Note */}
        <p className="text-center text-xs text-gray-500 mt-6 leading-relaxed">
          By upgrading, you agree to our Terms of Service and Privacy Policy.<br />
          Subscription renews automatically. Cancel anytime from your account settings.
        </p>
      </div>
    </div>
  );
}
