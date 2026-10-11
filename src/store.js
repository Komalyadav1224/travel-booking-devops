// In-memory data store (seeded). Replace with a real DB (Postgres/Mongo) for production.
let destinations, packages, bookings, users, nextBookingId, nextUserId;

function reset() {
  destinations = [
    { id: 1, name: 'Goa', country: 'India', description: 'Beaches, nightlife and Portuguese heritage.' },
    { id: 2, name: 'Manali', country: 'India', description: 'Himalayan hill station for snow and adventure.' },
    { id: 3, name: 'Bali', country: 'Indonesia', description: 'Temples, rice terraces and surf.' },
    { id: 4, name: 'Dubai', country: 'UAE', description: 'Skyscrapers, desert safari and shopping.' }
  ];
  packages = [
    { id: 1, destinationId: 1, title: 'Goa Beach Escape', days: 4, price: 15000 },
    { id: 2, destinationId: 1, title: 'Goa Premium Resort', days: 5, price: 28000 },
    { id: 3, destinationId: 2, title: 'Manali Snow Trip', days: 5, price: 18000 },
    { id: 4, destinationId: 3, title: 'Bali Honeymoon', days: 6, price: 65000 },
    { id: 5, destinationId: 4, title: 'Dubai Desert Special', days: 4, price: 55000 }
  ];
  bookings = [];
  users = [];
  nextBookingId = 1;
  nextUserId = 1;
}
reset();

module.exports = {
  reset,
  // destinations & packages
  listDestinations: () => destinations,
  addDestination: (d) => { const x = { id: destinations.length + 1, ...d }; destinations.push(x); return x; },
  listPackages: (destinationId) =>
    destinationId ? packages.filter((p) => p.destinationId === Number(destinationId)) : packages,
  getPackage: (id) => packages.find((p) => p.id === Number(id)),
  counts: () => ({ destinations: destinations.length, packages: packages.length, bookings: bookings.length }),

  // users
  createUser: ({ name, email, passwordHash }) => {
    const u = { id: nextUserId++, name, email, passwordHash, createdAt: new Date().toISOString() };
    users.push(u);
    return u;
  },
  findUserByEmail: (email) => users.find((u) => u.email === email),
  findUserById: (id) => users.find((u) => u.id === Number(id)),

  // bookings (always tied to a user)
  listBookings: (userId) => (userId === undefined ? bookings : bookings.filter((b) => b.userId === userId)),
  createBooking: ({ pkg, user, travelers }) => {
    const b = {
      id: nextBookingId++, userId: user.id, packageId: pkg.id, packageTitle: pkg.title,
      name: user.name, email: user.email, travelers,
      totalPrice: pkg.price * travelers, status: 'CONFIRMED', createdAt: new Date().toISOString()
    };
    bookings.push(b);
    return b;
  },
  // returns undefined if the booking does not exist OR belongs to another user
  cancelBooking: (id, userId) => {
    const b = bookings.find((x) => x.id === Number(id) && x.userId === userId);
    if (b) b.status = 'CANCELLED';
    return b;
  }
};