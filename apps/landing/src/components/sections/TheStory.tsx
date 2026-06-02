'use client';

import { motion } from 'motion/react';
import NetworkVisualization from '../NetworkVisualization';

export default function TheStory() {
  return (
    <section id="invitation" className="relative min-h-screen flex items-start overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-karmyq-green-50/80 via-karmyq-warmWhite to-karmyq-teal-50/40">
        <NetworkVisualization />
      </div>

      <div className="relative z-10 w-full section-padding container-narrow pt-28 md:pt-36 pb-24">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="font-serif text-4xl md:text-5xl lg:text-6xl font-light text-karmyq-green-700 leading-tight tracking-tight mb-8 max-w-3xl"
        >
          Help build the neighborhood layer the internet forgot.
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="border-l-4 border-karmyq-green-400 bg-karmyq-green-50/80 pl-6 py-4 pr-6 mb-10 max-w-3xl"
        >
          <p className="text-karmyq-brown-600 text-base font-light leading-relaxed">
            Karmyq.org is the commons: the manifesto, research, stories, and founding-circle invitation.
            Karmyq.com is the working proof-of-concept. This relaunch is for the people who saw the LinkedIn
            post and thought: <em className="not-italic text-karmyq-brown-900">I might be useful here.</em>
          </p>
        </motion.div>

        <motion.hr
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.55 }}
          className="border-karmyq-brown-200 mb-14"
        />

        <div className="max-w-3xl">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.65 }}
            className="font-serif text-3xl md:text-4xl font-normal text-karmyq-brown-900 leading-tight mb-8"
          >
            We&apos;re forming a small founding circle before we widen the door.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.75 }}
            className="space-y-5 body-large"
          >
            <p>
              Karmyq is open-source infrastructure for neighborhoods, mutual aid groups, and local communities
              to coordinate help, share skills, and build trust — without surveillance, ads, or platform extraction.
            </p>
            <p>
              The next step is not a broad launch. It is a careful conversation with people who understand
              trust, civic systems, services, caregiving, governance, open-source software, design, research,
              and the messy reality of local life.
            </p>
            <p>
              If that sounds like your lens, this is the invitation: pressure-test the idea, name what is missing,
              and help decide what the platform must become before it asks more communities to depend on it.
            </p>
          </motion.div>

          <motion.blockquote
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.9 }}
            className="font-serif text-2xl md:text-3xl italic font-light text-karmyq-green-700 border-y border-karmyq-brown-200 py-8 my-10 leading-relaxed"
          >
            Meaning-making, not accounting.
          </motion.blockquote>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.0 }}
            className="space-y-5 body-large"
          >
            <p>
              We are especially looking for specialists who can bring honest discipline to the founding layer:
              community organizers, social workers, therapists, educators, local-service providers, civic technologists,
              open-source builders, researchers, and people who have actually had to make trust work in a group.
            </p>
            <p>This is early, personal, and intentionally small. The goal is not hype. The goal is better judgment.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.1 }}
            className="border-t border-karmyq-brown-200 pt-8 mt-10 space-y-3"
          >
            <p className="font-serif text-xl italic text-karmyq-brown-600 leading-relaxed">
              Come with your expertise. Come with your skepticism. Come with the part of you that still believes
              local trust can be rebuilt without turning neighbors into customers.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.2 }}
            className="flex flex-col sm:flex-row gap-4 mt-10"
          >
            <a href="#founding-circle" className="btn-primary">
              Join the founding circle
            </a>
            <a href="#thinking" className="btn-secondary">
              Read the thinking
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
