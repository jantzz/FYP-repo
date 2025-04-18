CREATE TABLE role
(
    roleName VARCHAR(50) PRIMARY KEY,
    description VARCHAR(255)
);

--department table for having each department have a shift in the system
CREATE TABLE department
(
    departmentName VARCHAR(50) PRIMARY KEY,
    description VARCHAR(255),
    shifting boolean NOT NULL DEFAULT true
);

CREATE TABLE user
(
    userId INT UNSIGNED ZEROFILL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50),
    birthday DATE NOT NULL, 
    gender ENUM('Male', 'Female', 'other'),
    department VARCHAR(50),
    assignedTask VARCHAR(255),
    CONSTRAINT userFK1 FOREIGN KEY (role)
        REFERENCES role (roleName)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT userFK2 FOREIGN KEY (department)
        REFERENCES department (departmentName)
        ON UPDATE CASCADE ON DELETE SET NULL
) AUTO_INCREMENT = 1; 

CREATE TABLE shift
(
    shiftId INT UNSIGNED ZEROFILL AUTO_INCREMENT PRIMARY KEY,
    employeeId INT UNSIGNED NOT NULL, 
    startDate DATE NOT NULL, 
    endDate DATE NOT NULL, 
    title VARCHAR(255),
    status VARCHAR(50) NOT NULL, 
    CONSTRAINT shiftFK1 FOREIGN KEY (employeeId)
        REFERENCES user(userId)
        ON UPDATE CASCADE ON DELETE CASCADE
) AUTO_INCREMENT = 1; 

CREATE TABLE pendingShift
(
    pendingShiftId INT UNSIGNED ZEROFILL AUTO_INCREMENT PRIMARY KEY,
    employeeId INT UNSIGNED NOT NULL, 
    startDate DATE NOT NULL, 
    endDate DATE NOT NULL, 
    title VARCHAR(255),
    status VARCHAR(50) NOT NULL, 
    CONSTRAINT pendingShiftFK1 FOREIGN KEY (employeeId)
        REFERENCES user(userId)
        ON UPDATE CASCADE ON DELETE CASCADE,
    INDEX idx_status (status)
) AUTO_INCREMENT = 1;

