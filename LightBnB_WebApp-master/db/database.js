const properties = require("./json/properties.json");
const users = require("./json/users.json");

const { Pool } = require('pg');

const pool = new Pool({
  user: 'vagrant',
  password: '123',
  host: 'localhost',
  database: 'lightbnb'
});
// the following assumes that you named your connection variable `pool`
pool.query(`SELECT title FROM properties LIMIT 10;`).then(response => {
  // console.log(response);
}).catch(error => {
  console.log(error.message);
});

/// Users

/**
 * Get a single user from the database given their email.
 * @param {String} email The email of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithEmail = function(email) {
  const queryString = `
    SELECT *
    FROM users
    WHERE email = $1
  `;
  return pool.query(queryString, [email])
    .then(res => {
      if (res.rows.length) {
        return res.rows[0];
      } else {
        return null;
      }
    });
};


/**
 * Get a single user from the database given their id.
 * @param {string} id The id of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithId = function(id) {
  const queryString = `
    SELECT *
    FROM users
    WHERE id = $1
  `;
  return pool.query(queryString, [id])
    .then(res => {
      if (res.rows.length) {
        return res.rows[0];
      } else {
        return null;
      }
    });
};


/**
 * Add a new user to the database.
 * @param {{name: string, password: string, email: string}} user
 * @return {Promise<{}>} A promise to the user.
 */
const addUser = function(user) {
  const queryString = `
    INSERT INTO users (name, email, password)
    VALUES ($1, $2, $3)
    RETURNING *
  `;
  const values = [user.name, user.email, user.password];
  return pool.query(queryString, values)
    .then(res => res.rows[0]);
};


/// Reservations

/**
 * Get all reservations for a single user.
 * @param {string} guest_id The id of the user.
 * @return {Promise<[{}]>} A promise to the reservations.
 */
const getAllReservations = function(guest_id, limit = 10) {
  const queryString = `
    SELECT reservations.*, properties.*, AVG(property_reviews.rating) as average_rating
    FROM reservations
    JOIN properties ON reservations.property_id = properties.id
    JOIN property_reviews ON properties.id = property_reviews.property_id
    WHERE reservations.guest_id = $1 AND reservations.end_date < now()::date
    GROUP BY reservations.id, properties.id
    ORDER BY reservations.start_date
    LIMIT $2;
  `;
  const values = [guest_id, limit];
  return pool.query(queryString, values)
    .then(res => res.rows);
};


/// Properties

/**
 * Get all properties.
 * @param {{}} options An object containing query options.
 * @param {*} limit The number of results to return.
 * @return {Promise<[{}]>}  A promise to the properties.
 */
const getAllProperties = function(options, limit = 10) {
  const queryParams = [];

  // Start query string with all information that comes before the WHERE clause
  let queryString = `
    SELECT properties.*, AVG(property_reviews.rating) as average_rating
    FROM properties
    JOIN property_reviews ON properties.id = property_id
  `;

  // Add WHERE clause to query string if options object is provided
  if (options) {
    queryString += `WHERE `;
    let whereClauseAdded = false;

    // Add city filter to query string
    if (options.city) {
      queryParams.push(`%${options.city}%`);
      queryString += `city LIKE $${queryParams.length} `;
      whereClauseAdded = true;
    }

    // Add minimum price filter to query string
    if (options.minimum_price_per_night) {
      queryParams.push(Number(options.minimum_price_per_night) * 100);
      if (whereClauseAdded) {
        queryString += `AND `;
      }
      queryString += `cost_per_night >= $${queryParams.length} `;
      whereClauseAdded = true;
    }

    // Add maximum price filter to query string
    if (options.maximum_price_per_night) {
      queryParams.push(Number(options.maximum_price_per_night) * 100);
      if (whereClauseAdded) {
        queryString += `AND `;
      }
      queryString += `cost_per_night <= $${queryParams.length} `;
      whereClauseAdded = true;
    }

    // Add minimum rating filter to query string
    if (options.minimum_rating) {
      queryParams.push(Number(options.minimum_rating));
      if (whereClauseAdded) {
        queryString += `AND `;
      }
      queryString += `property_reviews.rating >= $${queryParams.length} `;
      whereClauseAdded = true;
    }
  }

  // Finish query string with all information that comes after the WHERE clause
  queryString += `
    GROUP BY properties.id
  `;
  if (options && options.minimum_rating) {
    queryString += `
      HAVING AVG(property_reviews.rating) >= $${queryParams.length}
    `;
  }
  queryParams.push(limit);
  queryString += `
    ORDER BY cost_per_night
    LIMIT $${queryParams.length};
  `;

  // Log the query string for debugging purposes
  console.log(queryString, queryParams);

  // Execute query with dynamic query string and provided query parameters
  return pool.query(queryString, queryParams)
    .then(res => res.rows);
};


/**
 * Add a property to the database
 * @param {{}} property An object containing all of the property details.
 * @return {Promise<{}>} A promise to the property.
 */
const addProperty = function (property) {
  const query = {
    text: `INSERT INTO properties (
            owner_id,
            title,
            description,
            thumbnail_photo_url,
            cover_photo_url,
            cost_per_night,
            street,
            city,
            province,
            post_code,
            country,
            parking_spaces,
            number_of_bathrooms,
            number_of_bedrooms
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          RETURNING *;`,
    values: [
      property.owner_id,
      property.title,
      property.description,
      property.thumbnail_photo_url,
      property.cover_photo_url,
      property.cost_per_night,
      property.street,
      property.city,
      property.province,
      property.post_code,
      property.country,
      property.parking_spaces,
      property.number_of_bathrooms,
      property.number_of_bedrooms
    ]
  };

  return pool.query(query)
    .then(res => {
      return res.rows[0];
    })
    .catch(err => {
      console.error(err);
    });
};


module.exports = {
  getUserWithEmail,
  getUserWithId,
  addUser,
  getAllReservations,
  getAllProperties,
  addProperty,
};
