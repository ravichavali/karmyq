# JMeter Load Test Plans

Three load patterns for Karmyq API testing.

## Prerequisites

1. Install Apache JMeter 5.6+
2. Run the simulation seeding first to populate users:
   ```bash
   npx ts-node simulation/scripts/reset.ts
   npx ts-node simulation/scripts/seed-founders.ts
   npx ts-node simulation/scripts/run.ts --load-profile=steady &
   sleep 300  # Let it run 5 min to grow the user pool
   ```
3. Export users to CSV:
   ```bash
   node -e "const u=require('./state/users.json'); console.log(u.map(x=>x.email+','+x.password).join('\n'))" > /tmp/karmyq-users.csv
   ```

## Run Plans

```bash
# Steady state: 20 concurrent users, indefinite
jmeter -n -t jmeter/steady-state.jmx \
  -JHOST=karmyq.com -JPROTOCOL=https \
  -JCONCURRENCY=20 \
  -JUSERS_CSV=/tmp/karmyq-users.csv \
  -l results/steady-results.jtl

# Spike test: ramp 5→100 users in 2 min, hold 5 min
jmeter -n -t jmeter/spike.jmx \
  -JHOST=karmyq.com -JPROTOCOL=https \
  -JUSERS_CSV=/tmp/karmyq-users.csv \
  -l results/spike-results.jtl

# Ramp test: 0→50 users over 30 min (soak)
jmeter -n -t jmeter/ramp.jmx \
  -JHOST=karmyq.com -JPROTOCOL=https \
  -JUSERS_CSV=/tmp/karmyq-users.csv \
  -l results/ramp-results.jtl

# Generate HTML report
jmeter -g results/steady-results.jtl -o results/steady-report/
```

## For local testing (dev machine)
```bash
jmeter -n -t jmeter/steady-state.jmx \
  -JHOST=localhost -JPROTOCOL=http \
  -JCONCURRENCY=5 \
  -JUSERS_CSV=/tmp/karmyq-users.csv \
  -l results/local-results.jtl
```

## Metrics integration
JMeter results flow into Grafana via the Backend Listener (optional).
Add `<BackendListener>` pointing to Graphite at `localhost:2003` if you
want real-time JMeter metrics in Grafana alongside simulation metrics.
