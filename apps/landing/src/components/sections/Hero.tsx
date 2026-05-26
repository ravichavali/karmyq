'use client';

import { motion } from 'framer-motion';
import NetworkVisualization from '../NetworkVisualization';

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-karmyq-green-50/80 via-karmyq-warmWhite to-karmyq-teal-50/40">
        <NetworkVisualization />
      </div>

      {/* Content */}
      <div className="relative z-10 section-padding container-narrow text-center pt-28 md:pt-36">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-karmyq-green-600 font-medium text-sm md:text-base tracking-widest uppercase mb-6"
        >
          Mutual aid for everyday life
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="heading-1 text-karmyq-brown-900 mb-6"
        >
          Ask for help. Offer what you can.{' '}
          <span className="text-karmyq-green-600">Build real connections.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="body-large max-w-2xl mx-auto mb-10"
        >
          Karmyq connects neighbors who help each other — rides, borrowed tools, childcare, home repairs. No money changes hands. Just community.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <a href="https://karmyq.com" className="btn-primary">
            Start Your Community
          </a>
          <a href="#about" className="btn-secondary">
            See How It Works
          </a>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-6 h-10 rounded-full border-2 border-karmyq-brown-300 flex items-start justify-center p-1.5"
          >
            <div className="w-1.5 h-2.5 rounded-full bg-karmyq-brown-400" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
