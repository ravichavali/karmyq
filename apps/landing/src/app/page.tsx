'use client';

import Header from '../components/Header';
import Hero from '../components/sections/Hero';
import TheCrack from '../components/sections/TheCrack';
import Opportunity from '../components/sections/Opportunity';
import WhatIsKarmyq from '../components/sections/WhatIsKarmyq';
import HowItWorks from '../components/sections/HowItWorks';
import ComparisonTable from '../components/sections/ComparisonTable';
import Principles from '../components/sections/Principles';
import FadingTimeline from '../components/sections/FadingTimeline';
import CommunityStories from '../components/sections/CommunityStories';
import Research from '../components/sections/Research';
import Movement from '../components/sections/Movement';
import CTAs from '../components/sections/CTAs';
import Footer from '../components/Footer';

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <TheCrack />
        <Opportunity />
        <WhatIsKarmyq />
        <HowItWorks />
        <ComparisonTable />
        <Principles />
        <FadingTimeline />
        <CommunityStories />
        <Research />
        <Movement />
        <CTAs />
      </main>
      <Footer />
    </>
  );
}
