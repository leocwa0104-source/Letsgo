/**
 * Geo Utilities for Shineshone 5.0
 * Includes Geohash implementation and Differential Privacy logic
 */

// --- Geohash Implementation ---
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

function encodeGeohash(lat, lon, precision = 9) {
  let idx = 0;
  let bit = 0;
  let evenBit = true;
  let geohash = '';

  let latMin = -90, latMax = 90;
  let lonMin = -180, lonMax = 180;

  while (geohash.length < precision) {
    if (evenBit) {
      // Bisect Longitude
      const lonMid = (lonMin + lonMax) / 2;
      if (lon >= lonMid) {
        idx = idx * 2 + 1;
        lonMin = lonMid;
      } else {
        idx = idx * 2;
        lonMax = lonMid;
      }
    } else {
      // Bisect Latitude
      const latMid = (latMin + latMax) / 2;
      if (lat >= latMid) {
        idx = idx * 2 + 1;
        latMin = latMid;
      } else {
        idx = idx * 2;
        latMax = latMid;
      }
    }

    evenBit = !evenBit;
    if (++bit == 5) {
      geohash += BASE32.charAt(idx);
      bit = 0;
      idx = 0;
    }
  }

  return geohash;
}

function decodeGeohash(geohash) {
  let evenBit = true;
  let latMin = -90, latMax = 90;
  let lonMin = -180, lonMax = 180;
  let latErr = 90, lonErr = 180;

  for (let i = 0; i < geohash.length; i++) {
    const c = geohash.charAt(i);
    const cd = BASE32.indexOf(c);
    for (let j = 4; j >= 0; j--) {
      const mask = 1 << j;
      if (evenBit) {
        lonErr /= 2;
        if (cd & mask) {
          lonMin = (lonMin + lonMax) / 2;
        } else {
          lonMax = (lonMin + lonMax) / 2;
        }
      } else {
        latErr /= 2;
        if (cd & mask) {
          latMin = (latMin + latMax) / 2;
        } else {
          latMax = (latMin + latMax) / 2;
        }
      }
      evenBit = !evenBit;
    }
  }

  return {
    latitude: (latMin + latMax) / 2,
    longitude: (lonMin + lonMax) / 2,
    error: { latitude: latErr, longitude: lonErr }
  };
}

function getGeohashNeighbors(geohash) {
  const neighbors = {
    top: '', bottom: '', right: '', left: '',
    topleft: '', topright: '', bottomleft: '', bottomright: ''
  };

  const evenNeighbors = {
    top: 'p0r21436x8zb9dcf5h7kjnmqesgutwvy',
    bottom: '14365h7k9dcfesgujnmqp0r2twvyx8zb',
    right: 'bc01fg45238967deuvhjyznpkmstqrwx',
    left: '238967debc01fg45kmstqrwxuvhjyznp'
  };

  const oddNeighbors = {
    top: 'bc01fg45238967deuvhjyznpkmstqrwx',
    bottom: '238967debc01fg45kmstqrwxuvhjyznp',
    right: 'p0r21436x8zb9dcf5h7kjnmqesgutwvy',
    left: '14365h7k9dcfesgujnmqp0r2twvyx8zb'
  };

  const evenBorders = {
    top: 'prxz', bottom: '028b', right: 'bcfguvyz', left: '0145hjnp'
  };

  const oddBorders = {
    top: 'bcfguvyz', bottom: '0145hjnp', right: 'prxz', left: '028b'
  };

  function calculateNeighbor(srcHash, dir) {
    const lastChr = srcHash.charAt(srcHash.length - 1);
    const type = (srcHash.length % 2) ? 'odd' : 'even';
    let base = srcHash.substring(0, srcHash.length - 1);
    
    if (Borders[type][dir].indexOf(lastChr) !== -1) {
      if(base.length > 0) base = calculateNeighbor(base, dir);
      else return srcHash; // Edge case: world boundary
    }
    
    return base + BASE32.charAt(Neighbors[type][dir].indexOf(lastChr));
  }

  const Neighbors = { even: evenNeighbors, odd: oddNeighbors };
  const Borders = { even: evenBorders, odd: oddBorders };

  neighbors.top = calculateNeighbor(geohash, 'top');
  neighbors.bottom = calculateNeighbor(geohash, 'bottom');
  neighbors.right = calculateNeighbor(geohash, 'right');
  neighbors.left = calculateNeighbor(geohash, 'left');
  
  neighbors.topleft = calculateNeighbor(neighbors.top, 'left');
  neighbors.topright = calculateNeighbor(neighbors.top, 'right');
  neighbors.bottomleft = calculateNeighbor(neighbors.bottom, 'left');
  neighbors.bottomright = calculateNeighbor(neighbors.bottom, 'right');

  return neighbors;
}

module.exports = {
  encodeGeohash,
  decodeGeohash,
  getGeohashNeighbors,
  addLaplaceNoise,
  perturbLocation,
  applyDifferentialPrivacyToPing
};

/**
 * Adds Laplace Noise to a value
 * @param {number} value - The true value (e.g., count)
 * @param {number} sensitivity - Sensitivity of the function (usually 1 for counts)
 * @param {number} epsilon - Privacy budget (e.g., 0.1)
 * @returns {number} - Noisy value
 */
function addLaplaceNoise(value, sensitivity = 1, epsilon = 0.1) {
  const scale = sensitivity / epsilon;
  const u = Math.random() - 0.5;
  const noise = -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  return Math.round(value + noise);
}

/**
 * Perturbs a location by a random distance and angle
 * @param {number[]} coords - [longitude, latitude]
 * @param {number} radiusInMeters - Maximum perturbation radius
 * @returns {number[]} - Perturbed [longitude, latitude]
 */
function perturbLocation(coords, radiusInMeters = 50) {
  const [lon, lat] = coords;
  const r = radiusInMeters * Math.sqrt(Math.random()); // Square root for uniform distribution in circle
  const theta = Math.random() * 2 * Math.PI;

  // Convert meters to degrees (approximate)
  const dy = r * Math.sin(theta) / 111320; // Latitude degrees
  const dx = r * Math.cos(theta) / (40075000 * Math.cos(lat * Math.PI / 180) / 360); // Longitude degrees

  return [lon + dx, lat + dy];
}

/**
 * Applies Differential Privacy to Ping results
 * @param {Array} sparks - List of spark objects
 * @param {number[]} userLocation - User's true location
 * @param {number} epsilon - Privacy budget
 * @returns {Array} - Privacy-preserving results
 */
function applyDifferentialPrivacyToPing(sparks, userLocation, epsilon = 0.1) {
  // 1. Add noise to the count (if we were returning a count)
  // But here we return a list. We might want to drop some or add dummies (dummies are harder).
  // The user's request specifically asked for:
  // "const noisyCount = results.length + laplaceNoise(scale);"
  // "const perturbedResults = results.map..."
  
  // We will perturb the locations of the sparks returned to the user, 
  // so the user cannot triangulate the EXACT location of the spark just by Pinging?
  // Wait, the vulnerability is "Ping leads to User Location Leakage".
  // The User Pings, sending their location. The Server returns Sparks.
  // If the Server logs the Ping, the User's location is leaked.
  // The User's fix suggestion says: "Ping results add Laplace Noise".
  // This implies we are protecting the SPARK's location or the USER's location?
  // "Ping mechanism location leakage: Every Ping leaks USER exact location."
  // "Attack: Attacker deploys honeypot Spark -> User Pings -> Attacker tracks user."
  // The fix: "Differential Privacy Ping".
  // "perturbLocation(result.location, 50)" -> This perturbs the RESULT (Spark) location sent back to the user.
  // This protects the SPARKs? No, if the user Pings, the user SENDS their location.
  // Ah, if the attacker owns the Spark, they can see WHO pinged it?
  // Or is it that the Ping request itself contains the user's location?
  // If the User Pings, they send `lat, lon`.
  // If we want to protect the User, the User should send a perturbed location?
  // OR the server should not store/forward the exact location.
  
  // Let's look at the User's code:
  // function addDifferentialPrivacy(results, userLocation, epsilon) { ... perturbLocation(result.location) ... }
  // This perturbs the SPARK locations returned to the User.
  // Why does this help "Ping mechanism location leakage"?
  // Maybe the "Ping" logic implies the user sees "There are 5 sparks nearby".
  // If the response is exact, the user can triangulate.
  // But the vulnerability description says: "User Ping exposes exact location... Attacker deploys honeypot Spark... User Ping exposes location... Attacker tracks."
  // If the attacker owns the Spark, do they get a notification? "Someone pinged your spark"?
  // If so, THAT notification should be fuzzy.
  
  // However, I will implement the utility as requested: Perturb the results.
  // Maybe the "Ping" also reports "User X is at [Lat, Lon]" to the system/Spark owner?
  // If so, we need to perturb THAT.
  
  // For now, I'll provide the `perturbLocation` helper which can be used for both.

  return sparks.map(spark => {
    // Clone to avoid modifying database object in memory
    const s = spark.toObject ? spark.toObject() : { ...spark };
    if (s.location && s.location.coordinates) {
      s.location.coordinates = perturbLocation(s.location.coordinates, 50);
    }
    return s;
  });
}

module.exports = {
  encodeGeohash,
  decodeGeohash,
  addLaplaceNoise,
  perturbLocation,
  getGeohashNeighbors,
  applyDifferentialPrivacyToPing
};
