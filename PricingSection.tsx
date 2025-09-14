import React from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface PricingTier {
  id: string;
  name: string;
  price: string;
  features: string[];
  cta: string;
  recommended?: boolean;
}

const pricingTiers: PricingTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$0/month',
    features: ['5 AI agents', 'Basic automation', '24/7 support'],
    cta: 'Start Free Trial'
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$49/month',
    features: ['Unlimited agents', 'Advanced workflows', 'Priority support'],
    cta: 'Start Free Trial',
    recommended: true
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    features: ['Custom integrations', 'Dedicated manager', 'SLA guarantee'],
    cta: 'Contact Sales'
  }
];

const PricingSection: React.FC = () => {
  return (
    <section className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-primary">Pricing Plans</h2>
        <p className="text-sm text-slate-400">Choose the plan that fits your needs</p>
      </div>

      <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-4">
        {pricingTiers.map((tier) => (
          <Card
            key={tier.id}
            className={`relative bg-slate-800/50 border-slate-700 backdrop-blur-sm ${
              tier.recommended 
                ? 'ring-2 ring-accent ring-offset-2 ring-offset-slate-950 scale-105' 
                : ''
            }`}
          >
            {tier.recommended && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-accent text-slate-950 px-3 py-1 text-xs font-semibold rounded-full">
                  Recommended
                </span>
              </div>
            )}
            
            <CardHeader className="text-center space-y-2 pb-4">
              <h3 className="text-lg font-semibold text-white">{tier.name}</h3>
              <div className="text-2xl font-bold text-primary">{tier.price}</div>
            </CardHeader>

            <CardContent className="space-y-4">
              <ul className="space-y-2" role="list" aria-label={`${tier.name} plan features`}>
                {tier.features.map((feature, index) => (
                  <li key={index} className="flex items-center text-sm text-slate-300">
                    <span className="w-1.5 h-1.5 bg-accent rounded-full mr-3 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                className={`w-full ${
                  tier.recommended
                    ? 'bg-accent hover:bg-accent/90 text-slate-950'
                    : 'bg-slate-700 hover:bg-slate-600 text-white'
                }`}
                aria-label={`${tier.cta} for ${tier.name} plan`}
              >
                {tier.cta}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
};

export default PricingSection;
