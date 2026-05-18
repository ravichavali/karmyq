'use client';

import { motion } from 'motion/react';
import NetworkVisualization from '../NetworkVisualization';

export default function TheStory() {
  return (
    <section id="story" className="relative min-h-screen flex items-start overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-karmyq-green-50/80 via-karmyq-warmWhite to-karmyq-teal-50/40">
        <NetworkVisualization />
      </div>

      <div className="relative z-10 w-full section-padding container-narrow pt-28 md:pt-36 pb-24">
        {/* Tagline eyebrow */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-karmyq-brown-400 text-xs font-light tracking-widest uppercase mb-6"
        >
          Meaning-making, not accounting
        </motion.p>

        {/* Functional subheadline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="border-l-4 border-karmyq-green-400 bg-karmyq-green-50/80 pl-6 py-4 pr-6 mb-10 max-w-2xl"
        >
          <p className="text-karmyq-brown-600 text-base font-light leading-relaxed">
            Karmyq is open-source infrastructure for neighborhoods, mutual aid groups, and local communities
            to coordinate help, share skills, and build trust — without surveillance, ads, or platform extraction.
          </p>
        </motion.div>

        <motion.hr
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.55 }}
          className="border-karmyq-brown-200 mb-14"
        />

        {/* Emotional narrative */}
        <div className="max-w-2xl">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.65 }}
            className="font-serif text-3xl md:text-4xl font-normal text-karmyq-brown-900 leading-tight mb-8"
          >
            You have neighbors whose names you don&apos;t know.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.75 }}
            className="space-y-5 body-large"
          >
            <p>
              You have passed through cities, shared buildings with hundreds of people, moved through crowds —
              and emerged more alone than when you arrived. This is not a personal failure.
              It is the shape of the world we built.
            </p>
            <p>But underneath it, the instinct didn&apos;t go away.</p>
            <p>
              In the early weeks of Covid, before governments had formed a plan, kitchens appeared. In Mumbai and
              Nairobi, in Tehran and São Paulo — ordinary people, unorganized, started cooking for strangers. Posted
              on walls. Stood at corners handing things to people they&apos;d never see again. No application form.
              No means test. Just: <em className="text-karmyq-brown-900 not-italic font-medium">here, eat</em>.
            </p>
            <p>
              It wasn&apos;t charity. It was memory. Something in them remembered how humans are supposed to work,
              and acted on it before thinking twice.
            </p>
          </motion.div>

          <motion.blockquote
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.9 }}
            className="font-serif text-2xl md:text-3xl italic font-light text-karmyq-green-700 border-y border-karmyq-brown-200 py-8 my-10 leading-relaxed"
          >
            Crisis strips away everything we&apos;ve learned to do instead,
            and we remember what we already knew.
          </motion.blockquote>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.0 }}
            className="space-y-5 body-large"
          >
            <p>
              It is there in the savings circles that have moved money through communities across West Africa,
              South Asia, and the Caribbean for generations — neighbors pooling their earnings and taking turns,
              no contracts, no collateral, nothing but the weight of relationship as security.
            </p>
            <p>
              It is there in the strangers who carry each other through floods. In the communities that hold each
              other through things that should have broken them.
            </p>
            <p>It never left. It is waiting to be given better conditions.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.1 }}
            className="border-t border-karmyq-brown-200 pt-8 mt-10 space-y-3"
          >
            <p className="font-serif text-xl italic text-karmyq-brown-600 leading-relaxed">
              Karmyq is built for that. Not as emergency response. As everyday life —
              the texture of a neighborhood that knows itself.
            </p>
            <p className="font-serif text-xl italic text-karmyq-brown-600">
              For the neighbor you almost know.
            </p>
            <p className="font-serif text-xl italic text-karmyq-brown-600">
              For the professional you&apos;d trust if trust had somewhere to grow.
            </p>
            <p className="font-serif text-xl italic text-karmyq-brown-600">
              For the community that&apos;s already there, waiting to be made visible.
            </p>
            <p className="font-serif text-xl italic text-karmyq-brown-600 leading-relaxed">
              The platforms that replaced local trust are showing their true nature. The window to build something
              different — before people stop believing it&apos;s possible — is narrowing. We&apos;re building now.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.2 }}
            className="flex flex-col sm:flex-row gap-4 mt-10"
          >
            <a href="https://karmyq.com" className="btn-primary">
              Find your neighbors
            </a>
            <a href="#thinking" className="btn-secondary">
              Read the thinking →
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
