'use client';

import Header from '../components/Header';
import TheStory from '../components/sections/TheStory';
import TheThinking from '../components/sections/TheThinking';
import WhatIsKarmyq from '../components/sections/WhatIsKarmyq';
import Principles from '../components/sections/Principles';
import HowItWorks from '../components/sections/HowItWorks';
import FadingTimeline from '../components/sections/FadingTimeline';
import CommunityStories from '../components/sections/CommunityStories';
import Movement from '../components/sections/Movement';
import CTAs from '../components/sections/CTAs';
import DeeperSections from '../components/sections/DeeperSections';
import Footer from '../components/Footer';

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <TheStory />
        <TheThinking />
        <WhatIsKarmyq />
        <Principles />
        <HowItWorks />
        <FadingTimeline />
        <CommunityStories />
        <Movement />
        <CTAs />
        <DeeperSections />
      </main>
      <Footer />
    </>
  );
}
