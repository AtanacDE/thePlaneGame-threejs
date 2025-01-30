var Colors = {
    red:0xf25346,
    white:0xffffff,
    brown:0x59332e,
    brownDark:0x23190f,
    pink:0xF5986E,
    teal:0x009999,
    blueDark:0x0077be,
    grey:0x726f76
};

//threejs variables
var scene, camera, fieldOfView, aspectRatio, nearPlane, farPlane, HEIGHT, WIDTH, renderer, container;
var parallelView = false;

//light variables
var hemisphereLight, ambientLight, shadowLight;

//sea variables
var sea;

//sky variables
var sky;

//airplane variables
var airplane;

//mouse variables
var mousePos={x:0, y:0};

//UI variables
var fieldDistance, energyBar, replayMessage, fieldLevel;
var blinkEnergy = false;

// game variables
var game;
var deltaTime = 0;
var newTime = new Date().getTime();
var oldTime = new Date().getTime();

var particlesPool = [];
var particlesInUse = [];

var coinsPool = [];

var enemiesPool1 = [];
var enemiesPool2 = [];

var particlesHolder;

var coinsHolder;

var enemiesHolder1;
var enemiesHolder2;

function resetGame(){
	game = {
		level: 1,
		levelLastUpdate: 0,
		distanceForLevelUpdate: 1000,

		speed: 0,
		baseSpeed: 0.00035,
		targetBaseSpeed: 0.00035,
		incrementSpeedByTime: 0.0000025,
		distanceForSpeedUpdate: 100,
		speedLastUpdate: 0,

		distance: 0,
		ratioSpeedDistance: 50,
		energy: 100,
		ratioSpeedEnergy: 3,

		wavesMinSpeed: 0.001,
		wavesMaxSpeed: 0.003,
		minWaveAmp: 5,
		maxWaveAmp: 20,

		planeDefaultHeight: 100,
		planeAmpHeight:80,
		planeSpeed: 0,
		planeMinSpeed: 1,
		planeMaxSpeed: 1.6,
		planeFallSpeed: 0.001,

		planeCollisionDisplacementX:0,
        planeCollisionSpeedX:0,

        planeCollisionDisplacementY:0,
        planeCollisionSpeedY:0,

        planeCollisionDisplacementZ:0,
        planeCollisionSpeedZ:0,

		seaRadius:600,
        seaLength:800,

        enemiesSpeed1: 0.3,
        enemiesSpeed2: 0.5,
        enemyLastSpawn1: 0,
        enemyLastSpawn2: 0,
        distanceForEnemiesSpawn1: 100,
        distanceForEnemiesSpawn2: 50,

        enemyDistanceTolerance:20,
        enemyValue: 10,

        coinDistanceTolerance: 25,
        coinValue: 3,
        coinSpeed: 0.6,
        coinLastSpawn: 0,
        distanceForCoinSpawn: 100,

		status: "playing"
	};
	fieldLevel.innerHTML = Math.floor(game.level);
}

function clearScene(){
	renderer.renderLists.dispose();
}

function init(){
	fieldDistance = document.getElementById("distValue");
	energyBar = document.getElementById("energyBar");
	replayMessage = document.getElementById("replayMessage");
	fieldLevel = document.getElementById("levelValue");

	resetGame();
	createScene();

	createLights();

	createPlane();
	createSea();
	createSky();

	createCoins();

	createEnemies1();
	createEnemies2();

	createParticles();

	document.addEventListener('mousemove', handleMouseMove, false);
	document.addEventListener('mousedown', onDocumentMouseDown, false);

	animate();
}

function createScene(){
	//get the width and the height of the screen, use them to set up the aspect ratio of the camera and the size of the renderer
	HEIGHT = window.innerHeight;
	WIDTH = window.innerWidth;

	//create the scene
	scene = new THREE.Scene();

	//fog effect
	scene.fog = new THREE.Fog(0xe6f2ff, 100, 950);

	//create camera
	aspectRatio = WIDTH/HEIGHT;
	fieldOfView = 60;
	nearPlane = 100;
	farPlane = 10000;
	camera = new THREE.PerspectiveCamera(fieldOfView, aspectRatio, nearPlane, farPlane);

	//perpendicular perspective
	camera.position.set(0, game.planeDefaultHeight, 200);

	//create renderer
	//alpha allows transparency to show the gradient background defined in css
	renderer = new THREE.WebGLRenderer({alpha: true, antialias: true});

	//fill renderer to screen
	renderer.setSize(WIDTH, HEIGHT);

	//enable shadow rendering
	renderer.shadowMap.enabled = true;

	//add DOM element of renderer to container in HTML
	container = document.getElementById('world');
	container.appendChild(renderer.domElement);

	//listen for screen resizes
	window.addEventListener('resize', handleWindowResize, false);

}

function handleWindowResize(){
	HEIGHT = window.innerHeight;
	WIDTH = window.innerWidth;
	renderer.setSize(WIDTH, HEIGHT);
	camera.aspect = WIDTH/HEIGHT;
	camera.updateProjectionMatrix();
}

function createLights(){
	//hemisphere light is a gradient colored light
	//param(sky color, ground color, intensity)
	hemisphereLight = new THREE.HemisphereLight(0xaaaaaa, 0x000000, 0.9);

	ambientLight = new THREE.AmbientLight(0x87cefa, .5);

	//directional light as sun
	shadowLight = new THREE.DirectionalLight(0xffffff, 0.9);
	shadowLight.position.set(150, 350, 350);

	//allow shadow casting
	shadowLight.castShadow = true;

	//define the visible area of the projected shadow
	shadowLight.shadow.camera.left = -400;
	shadowLight.shadow.camera.right = 400;
	shadowLight.shadow.camera.top = 400;
	shadowLight.shadow.camera.bottom = -400;
	shadowLight.shadow.camera.near = 1;
	shadowLight.shadow.camera.far = 1000;

	//define the resolution of the shadow
	shadowLight.shadow.mapSize.width = 2048;
	shadowLight.shadow.mapSize.height = 2048;

	//add lights
	scene.add(hemisphereLight);  
	scene.add(ambientLight);
	scene.add(shadowLight);
}

Sea = function(){
	//cylinder geometry
	//param(radius top, radius bottom, height, #segments on radius, #segements vertically)
	var geom = new THREE.CylinderGeometry(game.seaRadius, game.seaRadius, game.seaLength, 40, 10);

	//rotate geometry on x
	geom.applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI/2));

	//waves
	//important: merge vertices to ensure continuity of the waves
	geom.mergeVertices();

	//get vertices
	var l = geom.vertices.length;

	//create an array to store new data associated to each vertex
	this.waves = [];

	for(var i=0; i<l; i++){
		//get each vertex
		var v = geom.vertices[i];

		//store data associated to it
		this.waves.push({
			y: v.y, 
			x: v.x, 
			z: v.z, 
			//random angle
			ang: Math.random()*Math.PI*2,
			//random distance
			amp: game.minWaveAmp + Math.random()*game.maxWaveAmp,
			//random speed per frame
			// speed: 0.016 + Math.random()*0.032
			speed: game.wavesMinSpeed + Math.random()*(game.wavesMaxSpeed - game.wavesMinSpeed)
		});
	}

	//create material
	var mat = new THREE.MeshPhongMaterial({
		color: Colors.blueDark,
		transparent: true,
		opacity: 0.7,
		flatShading: THREE.FlatShading
	});

	//create object
	this.mesh = new THREE.Mesh(geom, mat);

	//allow shadows
	this.mesh.receiveShadow = true;
}

Sea.prototype.moveWaves = function (){
	//get vertices
	var verts = this.mesh.geometry.vertices;
  	var l = verts.length;

	for (var i=0; i<l; i++) {
		var v = verts[i];

		//get data associated to it
		var vprops = this.waves[i];

		//update the position of the vertex
		v.x = vprops.x + Math.cos(vprops.ang)*vprops.amp;
		v.y = vprops.y + Math.sin(vprops.ang)*vprops.amp;

		//increment angle for the next frame
		vprops.ang += vprops.speed*deltaTime;
	}

	//tell renderer that geometry has changed
	this.mesh.geometry.verticesNeedUpdate = true;
}


function createSea(){
	sea = new Sea();
	sea.mesh.position.y = -600;
	scene.add(sea.mesh);
}

Cloud = function(){
	//create an empty container that holds parts of the cloud
	this.mesh = new THREE.Object3D();

	//cube geometry
	var geom = new THREE.BoxGeometry(20, 20, 20);

	//cloud material
	var mat = new THREE.MeshPhongMaterial({
		color: Colors.white
	});

	//duplicate geometry a random number of times
	var numBlocks = 3+Math.floor(Math.random()*3);
	for(var i=0; i<numBlocks; i++){
		//create mesh
		var m = new THREE.Mesh(geom, mat);

		m.position.x = i*15;
		m.position.y = Math.random()*10;
		m.position.z = Math.random()*10;
		m.rotation.z = Math.random()*Math.PI*2;
		m.rotation.y = Math.random()*Math.PI*2;

		//set random size
		var s = 0.1 + Math.random()*0.9;
		m.scale.set(s, s, s);

		//allow case and receive shadows
		m.castShadow = true;
		m.receiveShadow = true;

		//add to scene
		this.mesh.add(m);
	}
}

Cloud.prototype.rotate = function(){
	var l = this.mesh.children.length;
	for(var i=0; i<1; i++){
		var m = this.mesh.children[i];
		m.rotation.z+= Math.random()*.005*(i+1);
    	m.rotation.y+= Math.random()*.002*(i+1);
	}
}

Sky = function(){
	//create an empty container
	this.mesh = new THREE.Object3D();

	//number of clouds in sky
	this.numClouds = 30;
	this.clouds = [];

	//to distribute clouds consistently
	var stepAngle = Math.PI*2 / this.numClouds;

	//create clouds
	for(var i=0; i<this.numClouds; i++){
		var c = new Cloud();
		this.clouds.push(c);

		//rotation and position of each cloud
		var a = stepAngle*i; //final angle of the cloud
		var h = 850 + Math.random()*200; //distance between the center of axis and the cloud

		//convert polar coordinates(angle, distance) into cartesian coordinates(x, y)
		c.mesh.position.y = Math.sin(a)*h;
		c.mesh.position.x = Math.cos(a)*h;

		//rotate the cloud according to its position
		c.mesh.rotation.z = a + Math.PI/2;

		//position clouds at random depths
		// c.mesh.position.z = -400-Math.random()*400;
		c.mesh.position.z = Math.random()*(100 + 1300) -1300;

		//random scale for each cloud
		var s = 1+Math.random()*2;
		c.mesh.scale.set(s, s, s);

		//add cloud to scene
		this.mesh.add(c.mesh);
	}
}

Sky.prototype.moveClouds = function(){
	for(var i=0; i<this.numClouds; i++){
		var c = this.clouds[i];
		c.rotate();
	}
	this.mesh.rotation.z += game.speed*deltaTime;
}

function createSky(){
  	sky = new Sky();
  	sky.mesh.position.y = -600;
  	sky.mesh.position.z = 600;
  	scene.add(sky.mesh);
}

var AirPlane = function(){
	//create an empty container
	this.mesh = new THREE.Object3D();

	//create base
	var geomBase = new THREE.BoxGeometry(100, 24, 24, 1, 1, 1);
	var matBase = new THREE.MeshPhongMaterial({color: Colors.red, flatShading:THREE.FlatShading});
	var base = new THREE.Mesh(geomBase, matBase);
	base.castShadow = true;
	base.receiveShadow = true;
	this.mesh.add(base);

	//create nose
	var nose = createNose();
	nose.position.x = 27;
	this.mesh.add(nose);

	//create nose tip
	var noseTip = createPyramid();
	scaleMesh(noseTip, 25, 25, 25);
	rotateMesh(noseTip, Math.PI/2);
	noseTip.position.set(50, -12.5, 12.5);
	this.mesh.add(noseTip);

	//create tail
	var tail = createNose();
	rotateMesh(tail, Math.PI);
	tail.position.x = -26;
	this.mesh.add(tail);

	//create tail tip
	var geomTailTip = new THREE.CylinderGeometry(8, 12.5, 10, 40, 10);
	var matTailTip = new THREE.MeshPhongMaterial({color:Colors.grey, flatShading:THREE.FlatShading});
	var tailTip = new THREE.Mesh(geomTailTip, matTailTip);
	var transformTailTip = new THREE.Matrix4().makeRotationZ(Math.PI/2);
	tailTip.applyMatrix(transformTailTip);

	tailTip.castShadow = true;
	tailTip.receiveShadow = true;
	tailTip.position.set(-55, 0, 0);
	this.mesh.add(tailTip);


	//create tail wing 1
	var geomTailWing1 = new THREE.BoxGeometry(40,25,150,1,1,1);
	geomTailWing1.vertices[0].z -= 75;
	geomTailWing1.vertices[1].z += 75;
	geomTailWing1.vertices[2].z -= 75;
	geomTailWing1.vertices[3].z += 75;

	geomTailWing1.vertices[4].z += 25;
	geomTailWing1.vertices[4].y -= 12;
	geomTailWing1.vertices[4].x -= 25;
	geomTailWing1.vertices[6].z += 25;
	geomTailWing1.vertices[6].y += 12;
	geomTailWing1.vertices[6].x -= 25;

	geomTailWing1.vertices[5].z -= 75;
	geomTailWing1.vertices[5].x += 15;
	geomTailWing1.vertices[7].z -= 75;
	geomTailWing1.vertices[7].x += 15;

	var matTailWing1 = new THREE.MeshPhongMaterial({color:Colors.white, flatShading:THREE.FlatShading});
	var tailWing1 = new THREE.Mesh(geomTailWing1, matTailWing1);
	tailWing1.castShadow = true;
	tailWing1.receiveShadow = true;
	tailWing1.position.set(-30, 0, 0);
	this.mesh.add(tailWing1);

	//create tail wing 2
	var geomTailWing2 = new THREE.BoxGeometry(40,25,150,1,1,1);
	geomTailWing2.vertices[0].z -= 75;
	geomTailWing2.vertices[1].z += 75;
	geomTailWing2.vertices[2].z -= 75;
	geomTailWing2.vertices[3].z += 75;

	geomTailWing2.vertices[5].z -= 25;
	geomTailWing2.vertices[5].y -= 12;
	geomTailWing2.vertices[5].x -= 25;
	geomTailWing2.vertices[7].z -= 25;
	geomTailWing2.vertices[7].y += 12;
	geomTailWing2.vertices[7].x -= 25;

	geomTailWing2.vertices[4].z += 75;
	geomTailWing2.vertices[4].x += 15;
	geomTailWing2.vertices[6].z += 75;
	geomTailWing2.vertices[6].x += 15;

	var matTailWing2 = new THREE.MeshPhongMaterial({color:Colors.white, flatShading:THREE.FlatShading});
	var tailWing2 = new THREE.Mesh(geomTailWing2, matTailWing2);
	tailWing2.castShadow = true;
	tailWing2.receiveShadow = true;
	tailWing2.position.set(-30, 0, 0);
	this.mesh.add(tailWing2);

	// Create the tail fin
	var geomTailFin = new THREE.BoxGeometry(40,25,5,1,1,1);
	geomTailFin.vertices[0].x -= 35;
	geomTailFin.vertices[1].x -= 35;

	var matTailFin = new THREE.MeshPhongMaterial({color:Colors.red, flatShading:THREE.FlatShading});
	var tailFin = new THREE.Mesh(geomTailFin, matTailFin);
	tailFin.position.set(-25,25,0);
	tailFin.castShadow = true;
	tailFin.receiveShadow = true;
	this.mesh.add(tailFin);

	//create side wing 1
	var geomSideWing1 = new THREE.BoxGeometry(40,25,75,1,1,1);
	geomSideWing1.vertices[1].x += 35;
	geomSideWing1.vertices[1].y -= 12;
	geomSideWing1.vertices[1].z += 55;
	geomSideWing1.vertices[3].x += 35;
	geomSideWing1.vertices[3].y += 12;
	geomSideWing1.vertices[3].z += 55;

	geomSideWing1.vertices[4].x -= 35;
	geomSideWing1.vertices[4].y -= 12;
	geomSideWing1.vertices[4].z -= 5;
	geomSideWing1.vertices[6].x -= 35;
	geomSideWing1.vertices[6].y += 12;
	geomSideWing1.vertices[6].z -= 5;

	var matSideWing1 = new THREE.MeshPhongMaterial({color:Colors.red, flatShading:THREE.FlatShading});
	var sideWing1 = new THREE.Mesh(geomSideWing1, matSideWing1);
	sideWing1.position.set(0, 0, -45);
	sideWing1.castShadow = true;
	sideWing1.receiveShadow = true;
	this.mesh.add(sideWing1);

	//create side wing 2
	var geomSideWing2 = new THREE.BoxGeometry(40,25,75,1,1,1);
	geomSideWing2.vertices[0].x += 35;
	geomSideWing2.vertices[0].y -= 12;
	geomSideWing2.vertices[0].z -= 55;
	geomSideWing2.vertices[2].x += 35;
	geomSideWing2.vertices[2].y += 12;
	geomSideWing2.vertices[2].z -= 55;

	geomSideWing2.vertices[5].x -= 35;
	geomSideWing2.vertices[5].y -= 12;
	geomSideWing2.vertices[5].z += 5;
	geomSideWing2.vertices[7].x -= 35;
	geomSideWing2.vertices[7].y += 12;
	geomSideWing2.vertices[7].z += 5;

	var matSideWing2 = new THREE.MeshPhongMaterial({color:Colors.red, flatShading:THREE.FlatShading});
	var sideWing2 = new THREE.Mesh(geomSideWing2, matSideWing2);
	sideWing2.position.set(0, 0, 45);
	sideWing2.castShadow = true;
	sideWing2.receiveShadow = true;
	this.mesh.add(sideWing2);


	
	// propeller
	var geomPropeller = new THREE.BoxGeometry(10,4,4,1,1,1);
	var matPropeller = new THREE.MeshPhongMaterial({color:Colors.brown, flatShading:THREE.FlatShading});
	this.propeller = new THREE.Mesh(geomPropeller, matPropeller);
	this.propeller.castShadow = true;
	this.propeller.receiveShadow = true;
	
	// blades
	var geomBlade = new THREE.BoxGeometry(1,12,2,1,1,1);
	var matBlade = new THREE.MeshPhongMaterial({color:Colors.brownDark, flatShading:THREE.FlatShading});
	
	var blade1 = new THREE.Mesh(geomBlade, matBlade);
	blade1.position.set(-3,0,0);
	blade1.castShadow = true;
	blade1.receiveShadow = true;

	var blade2 = blade1.clone();
  	blade2.rotation.x = Math.PI/2;

	this.propeller.add(blade1);
	this.propeller.add(blade2);
	this.propeller.position.set(-58,0,0);
	this.mesh.add(this.propeller);

 	//flag
  	this.flag = new Flag();
  	var transformFlag = new THREE.Matrix4().makeRotationX(Math.PI/2);
	this.flag.mesh.applyMatrix(transformFlag);
  	this.flag.mesh.position.set(-60, 25, 0);
  	this.mesh.add(this.flag.mesh);

  	this.mesh.castShadow = true;
  	this.mesh.receiveShadow = true;


};

function createNose(){
	var geomNose = new THREE.BoxGeometry(50, 25, 25, 1, 1, 1);
	var matNose = new THREE.MeshPhongMaterial({color: Colors.white, flatShading:THREE.FlatShading});
	var nose = new THREE.Mesh(geomNose, matNose);

	geomNose.vertices[4].z+=12;
	geomNose.vertices[5].z-=12;

	geomNose.vertices[6].z+=12;
	geomNose.vertices[7].z-=12;

	nose.position.x = 51;
	nose.castShadow = true;
	nose.receiveShadow = true;

	return nose;
}

function createPyramid(){
	var geomPyramid = new THREE.Geometry();
	geomPyramid.vertices = [
    new THREE.Vector3( 0, 0, 0 ),
    new THREE.Vector3( 0, 1, 0 ),
    new THREE.Vector3( 1, 1, 0 ),
    new THREE.Vector3( 1, 0, 0 ),
    new THREE.Vector3( 0.5, 0.5, 1 )
	];

	geomPyramid.faces = [
	    new THREE.Face3( 0, 1, 2 ),
	    new THREE.Face3( 0, 2, 3 ),
	    new THREE.Face3( 1, 0, 4 ),
	    new THREE.Face3( 2, 1, 4 ),
	    new THREE.Face3( 3, 2, 4 ),
	    new THREE.Face3( 0, 3, 4 )
	];   

	var matPyramid = new THREE.MeshPhongMaterial({color: Colors.white, flatShading:THREE.FlatShading});
	var pyramid = new THREE.Mesh(geomPyramid, matPyramid);

	pyramid.castShadow = true;
	pyramid.receiveShadow = true;

	return pyramid;
}

function scaleMesh(mesh, width, length, height){
	var transformation = new THREE.Matrix4().makeScale(width, length, height);
	mesh.applyMatrix(transformation);
}

function rotateMesh(mesh, angle){
	var transformation = new THREE.Matrix4().makeRotationY(angle);
	mesh.applyMatrix(transformation);
}

function createPlane(){
	airplane = new AirPlane();
	airplane.mesh.scale.set(.25,.25,.25);
	airplane.mesh.position.y = 100;
	airplane.mesh.position.z = 0;
	scene.add(airplane.mesh);
}

function updatePlane(){
	var targetX, targetY, targetZ;
	game.planeSpeed = game.planeMinSpeed;

	if(parallelView == false){
		targetX = normalize(mousePos.x, -1, 1, -75, 75);
		targetY = normalize(mousePos.y, -1, 1, 25, 150);
		targetZ = 0;

		game.planeCollisionDisplacementX += game.planeCollisionSpeedX;
		targetX += game.planeCollisionDisplacementX;

		game.planeCollisionDisplacementY += game.planeCollisionSpeedY;
		targetY += game.planeCollisionDisplacementY;

		game.planeCollisionDisplacementZ += game.planeCollisionSpeedZ;
		targetZ += game.planeCollisionDisplacementZ;

		//smoother movement
		//move the plane at each frame by adding a fraction of the remaining distance
		airplane.mesh.position.x += (targetX - airplane.mesh.position.x)*0.1;
		airplane.mesh.position.y += (targetY - airplane.mesh.position.y)*0.1;
		airplane.mesh.position.z += (targetZ - airplane.mesh.position.z)*0.1;

		//rotate the plane proportionally to the remaining distance
		airplane.mesh.rotation.x = (airplane.mesh.position.y - targetY)*0.0064;
		airplane.mesh.rotation.y = (airplane.mesh.position.z - targetZ)*0.0128;
		airplane.mesh.rotation.z = (targetY - airplane.mesh.position.y)*0.0128;
	}
	else{
		targetX = 0;
		targetY = normalize(mousePos.y, -1, 1, 25, 150);
		targetZ = normalize(mousePos.x, -1, 1, -100, 100);

		game.planeCollisionDisplacementX += game.planeCollisionSpeedX;
		targetX += game.planeCollisionDisplacementX;

		game.planeCollisionDisplacementY += game.planeCollisionSpeedY;
		targetY += game.planeCollisionDisplacementY;

		game.planeCollisionDisplacementZ += game.planeCollisionSpeedZ;
		targetZ += game.planeCollisionDisplacementZ;


		//smoother movement
		//move the plane at each frame by adding a fraction of the remaining distance
		airplane.mesh.position.x += (targetX - airplane.mesh.position.x)*0.1;
		airplane.mesh.position.y += (targetY - airplane.mesh.position.y)*0.1;
		airplane.mesh.position.z += (targetZ - airplane.mesh.position.z)*0.1;

		//rotate the plane proportionally to the remaining distance
		airplane.mesh.rotation.x = (targetZ - airplane.mesh.position.z)*0.0128;
		airplane.mesh.rotation.y = (airplane.mesh.position.z - targetZ)*0.0128;
		airplane.mesh.rotation.z = (targetY - airplane.mesh.position.y)*0.0128;
	}



	game.planeCollisionSpeedX += (0-game.planeCollisionSpeedX)*deltaTime * 0.03;
  	game.planeCollisionDisplacementX += (0-game.planeCollisionDisplacementX)*deltaTime *0.01;
  	game.planeCollisionSpeedY += (0-game.planeCollisionSpeedY)*deltaTime * 0.03;
  	game.planeCollisionDisplacementY += (0-game.planeCollisionDisplacementY)*deltaTime *0.01;
  	game.planeCollisionSpeedZ += (0-game.planeCollisionSpeedZ)*deltaTime * 0.03;
  	game.planeCollisionDisplacementZ += (0-game.planeCollisionDisplacementZ)*deltaTime *0.01;


	airplane.propeller.rotation.x +=.2 + game.planeSpeed * deltaTime*.005;
	airplane.flag.updateFlags();
}

var Flag = function(){
  this.mesh = new THREE.Object3D();
  this.mesh.name = "flag";
  this.angleFlags=0;

  var geomFlag = new THREE.BoxGeometry(4,4,4);
  var matFlag = new THREE.MeshLambertMaterial({color:Colors.pink});
  var flag = new THREE.Mesh(geomFlag, matFlag);
  var flags = new THREE.Object3D();

  this.flagsTop = new THREE.Object3D();

  for (var i=0; i<12; i++){
    var h = flag.clone();
    var col = i%3;
    var row = Math.floor(i/3);
    var startPosZ = -4;
    var startPosX = -4;
    h.position.set(startPosX + row*4, 0, startPosZ + col*4);
    this.flagsTop.add(h);
  }
  flags.add(this.flagsTop);

  var geomFlagPole = new THREE.BoxGeometry(2,2,20);
  var matFlagPole = new THREE.MeshLambertMaterial({color:Colors.grey});
  var flagPole = new THREE.Mesh(geomFlagPole, matFlagPole);
  flagPole.position.set(11, 0, 4);
  flags.add(flagPole);


  this.mesh.add(flags);
}

Flag.prototype.updateFlags = function(){
  var flags = this.flagsTop.children;

  var l = flags.length;
  for (var i=0; i<l; i++){
    var h=f = flags[i];
    h.position.y = Math.cos(this.angleFlags+i/3)*4;
    h.position.z += Math.cos(this.angleFlags+i/3)*0.1;
  }
  this.angleFlags += game.speed*deltaTime*40;
}

Enemy = function(enemyNum){
	var geom;
	if(enemyNum == 1){
		geom = new THREE.BoxGeometry(5, 30, 30);
		this.isWall = true;
	}
	else{
		geom = new THREE.TetrahedronGeometry(8,2);
		this.isWall = false;
	}
	var mat = new THREE.MeshPhongMaterial({
    	color:Colors.red,
    	shininess:0,
    	specular:0xffffff,
    	flatShading:THREE.FlatShading
  	});
  	this.mesh = new THREE.Mesh(geom, mat);
  	this.mesh.castShadow = true;
  	this.angle = 0;
  	this.distance = 0;
}

EnemiesHolder = function(){
	this.mesh = new THREE.Object3D();
	this.enemiesInUse = [];
}

EnemiesHolder.prototype.spawnEnemies = function(enemyNum){
	var numEnemies = game.level;

	for (var i=0; i<numEnemies; i++){
    	var enemy;
    	if(enemyNum == 1){
	    	if (enemiesPool1.length) {
	      		enemy = enemiesPool1.pop();
	    	}
	    	else{
	      		enemy = new Enemy(1);
	    	}
    	}
    	else{
    		if (enemiesPool2.length) {
	      		enemy = enemiesPool2.pop();
	    	}
	    	else{
	      		enemy = new Enemy(2);
	    	}
    	}
    	enemy.angle = - (i*0.1);
    	enemy.distance = game.seaRadius + game.planeDefaultHeight + (-1 + Math.random() * 2) * (game.planeAmpHeight-20);
    	enemy.mesh.position.y = -game.seaRadius + Math.sin(enemy.angle)*enemy.distance;
    	enemy.mesh.position.x = Math.cos(enemy.angle)*enemy.distance;
    	enemy.mesh.position.z = 0 + Math.floor(Math.random()*(75 - -75 + 1)) - 75;


    	
    	this.mesh.add(enemy.mesh);
    	this.enemiesInUse.push(enemy);
  	}
}

EnemiesHolder.prototype.rotateEnemies = function(enemyNum){
	for(var i=0; i<this.enemiesInUse.length; i++){
		var enemy = this.enemiesInUse[i];
		if(enemyNum == 1){
			enemy.angle += game.speed*deltaTime*game.enemiesSpeed1;
		}
		else{
			enemy.angle += game.speed*deltaTime*game.enemiesSpeed2;
		}

		if(enemy.angle > Math.PI*2) enemy.angle -= Math.PI*2;

		enemy.mesh.position.y = -game.seaRadius + Math.sin(enemy.angle)*enemy.distance;
		enemy.mesh.position.x = Math.cos(enemy.angle)*enemy.distance;
		if(enemy.isWall == false){
			enemy.mesh.rotation.z += Math.random()*0.1;
			enemy.mesh.rotation.y += Math.random()*0.1;
		}

		var diffPos = airplane.mesh.position.clone().sub(enemy.mesh.position.clone());
		var d = diffPos.length();

		if(d < game.enemyDistanceTolerance){
			particlesHolder.spawnParticles(enemy.mesh.position.clone(), 15, Colors.red, 3);

			if(enemyNum == 1){
				enemiesPool1.unshift(this.enemiesInUse.splice(i, 1)[0]);
			}
			else{
				enemiesPool2.unshift(this.enemiesInUse.splice(i, 1)[0]);
			}

			this.mesh.remove(enemy.mesh);

			game.planeCollisionSpeedX = 100 * diffPos.x / d;	
      		game.planeCollisionSpeedY = 100 * diffPos.y / d;
      		game.planeCollisionSpeedZ = 100 * diffPos.z / d;

      		ambientLight.intensity = 2;

      		removeEnergy();
		}
		else if(enemy.angle > Math.PI){
			if(enemyNum == 1){
				enemiesPool1.unshift(this.enemiesInUse.splice(i, 1)[0]);
			}
			else{
				enemiesPool2.unshift(this.enemiesInUse.splice(i, 1)[0]);
			}

			this.mesh.remove(enemy.mesh);
			i--;
		}

	}
}

function createEnemies1(){
	for (var i=0; i<10; i++){
		var enemy = new Enemy(1);
		enemiesPool1.push(enemy);
	}
	enemiesHolder1 = new EnemiesHolder();
	scene.add(enemiesHolder1.mesh);
}

function createEnemies2(){
	for (var i=0; i<10; i++){
		var enemy = new Enemy(2);
		enemiesPool2.push(enemy);
	}
	enemiesHolder2 = new EnemiesHolder();
	scene.add(enemiesHolder2.mesh);
}

Coin = function(){
	var geom = new THREE.TetrahedronGeometry(5,0);
	var mat = new THREE.MeshPhongMaterial({
		color:Colors.teal,
		shininess:0,
		specular:0xffffff,
		flatShading:THREE.FlatShading

	});
	this.mesh = new THREE.Mesh(geom, mat);
	this.mesh.castShadow = true;
	this.angle = 0;
	this.distance = 0;
}

CoinsHolder = function(numCoins){
	this.mesh = new THREE.Object3D();
	this.coinsInUse = [];
	for(var i=0; i<numCoins; i++){
		var coin = new Coin();
		coinsPool.push(coin);
	}
}

CoinsHolder.prototype.spawnCoins = function(){
	var numCoins = 1 + Math.floor(Math.random()*10);
	var d = game.seaRadius + game.planeDefaultHeight + (-1 + Math.random() * 2) * (game.planeAmpHeight-20);
	var amplitude = 10 + Math.round(Math.random()*10);

	for(var i=0; i<numCoins; i++){
		var coin;
		if(coinsPool.length){
			coin = coinsPool.pop();
		}
		else{
			coin = new Coin();
		}
		this.mesh.add(coin.mesh);
		this.coinsInUse.push(coin);
		coin.angle = - (i*0.02);
		coin.distance = d + Math.cos(i*.5)*amplitude;

		coin.mesh.position.y = -game.seaRadius + Math.sin(coin.angle)*coin.distance;
		coin.mesh.position.x = Math.cos(coin.angle)*coin.distance;

	}
}

CoinsHolder.prototype.rotateCoins = function(){

	for(var i=0; i<this.coinsInUse.length; i++){
		var coin = this.coinsInUse[i];
		coin.angle += game.speed*deltaTime*game.coinSpeed;
		if(coin.angle > Math.PI*2){
			coin.angle -= Math.PI*2;
		}
		coin.mesh.position.y = -game.seaRadius + Math.sin(coin.angle)*coin.distance;
		coin.mesh.position.x = Math.cos(coin.angle)*coin.distance;
		coin.mesh.rotation.z += Math.random()*.1;
		coin.mesh.rotation.y += Math.random()*.1;

		var diffPos = airplane.mesh.position.clone().sub(coin.mesh.position.clone());
		var d = diffPos.length();
		if(d < game.coinDistanceTolerance){
			coinsPool.unshift(this.coinsInUse.splice(i,1)[0]);
			this.mesh.remove(coin.mesh);
			particlesHolder.spawnParticles(coin.mesh.position.clone(), 5, Colors.teal, .8);
			addEnergy();
			i--;
		}
		else if(coin.angle > Math.PI){
			coinsPool.unshift(this.coinsInUse.splice(i,1)[0]);
			this.mesh.remove(coin.mesh);
			i--;
		}
	}
}

function createCoins(){
	coinsHolder = new CoinsHolder(20);
	scene.add(coinsHolder.mesh);
}


Particle = function(){
	var geom = new THREE.TetrahedronGeometry(3,0);
	var mat = new THREE.MeshPhongMaterial({
		color:0x009999,
		shininess:0,
		specular:0xffffff,
		flatShading:THREE.FlatShading
	});
	this.mesh = new THREE.Mesh(geom,mat);
}

Particle.prototype.explode = function(pos, color, scale){
	var _this = this;
	var _p = this.mesh.parent;
	this.mesh.material.color = new THREE.Color(color);
	this.mesh.material.needsUpdate = true;
	this.mesh.scale.set(scale, scale, scale);
	var targetX = pos.x + (-1 + Math.random()*2)*50;
	var targetY = pos.y + (-1 + Math.random()*2)*50;
	var targetZ = pos.z + (-1 + Math.random()*2)*50;
	var speed = .6+Math.random()*.2;
	TweenMax.to(this.mesh.rotation, speed, {x:Math.random()*12, y:Math.random()*12, z:Math.random()*12});
  	TweenMax.to(this.mesh.scale, speed, {x:.1, y:.1, z:.1});
  	TweenMax.to(this.mesh.position, speed, {x:targetX, y:targetY, z:targetZ, delay:Math.random() *.1, ease:Power2.easeOut, onComplete:function(){
    	if(_p) _p.remove(_this.mesh);
      	_this.mesh.scale.set(1,1,1);
      	particlesPool.unshift(_this);
    	}});
}

ParticlesHolder = function (){
  	this.mesh = new THREE.Object3D();
  	this.particlesInUse = [];
}


ParticlesHolder.prototype.spawnParticles = function(pos, density, color, scale){

  	var numParticles = density;
  	for (var i=0; i<numParticles; i++){
    	var particle;
    	if (particlesPool.length) {
      		particle = particlesPool.pop();
    	}
    	else{
      		particle = new Particle();
    	}
    	this.mesh.add(particle.mesh);
	    particle.mesh.visible = true;
	    var _this = this;
	    particle.mesh.position.x = pos.x;
	    particle.mesh.position.y = pos.y;
	    particle.mesh.position.z = pos.z;
	    particle.explode(pos, color, scale);
  	}
}

function createParticles(){
	for(var i=0; i<10; i++){
		var particle = new Particle();
		particlesPool.push(particle);
	}
	particlesHolder = new ParticlesHolder();
	scene.add(particlesHolder.mesh);
}


function animate(){
	newTime = new Date().getTime();
  	deltaTime = newTime-oldTime;
  	oldTime = newTime;

  	if(game.status=="playing"){


  		if(Math.floor(game.distance)%game.distanceForCoinSpawn == 0 && Math.floor(game.distance) > game.coinLastSpawn){
  			game.coinLastSpawn = Math.floor(game.distance);
  			coinsHolder.spawnCoins();
  		}

  		if(Math.floor(game.distance)%game.distanceForSpeedUpdate == 0 && Math.floor(game.distance) > game.speedLastUpdate){
  			game.speedLastUpdate = Math.floor(game.distance);
      		game.targetBaseSpeed += game.incrementSpeedByTime*deltaTime;
  		}

  		if (Math.floor(game.distance)%game.distanceForEnemiesSpawn1 == 0 && Math.floor(game.distance) > game.enemyLastSpawn1){
      		game.enemyLastSpawn1 = Math.floor(game.distance);
      		enemiesHolder1.spawnEnemies(1);
    	}

    	if (Math.floor(game.distance)%game.distanceForEnemiesSpawn2 == 0 && Math.floor(game.distance) > game.enemyLastSpawn2){
      		game.enemyLastSpawn2 = Math.floor(game.distance);
      		enemiesHolder2.spawnEnemies(2);
    	}

    	if(Math.floor(game.distance)%game.distanceForLevelUpdate == 0 && Math.floor(game.distance) > game.levelLastUpdate){
    		game.levelLastUpdate = Math.floor(game.distance);
    		game.level++;
    		fieldLevel.innerHTML = Math.floor(game.level);
    	}


  		updatePlane();
  		updateDistance();
  		updateEnergy();

  		game.baseSpeed += (game.targetBaseSpeed - game.baseSpeed) * deltaTime * 0.02;
    	game.speed = game.baseSpeed * game.planeSpeed;
  	}
  	else if(game.status=="gameover"){
	    game.speed *= .99;
	    airplane.mesh.rotation.z += (-Math.PI/2 - airplane.mesh.rotation.z)*.0002*deltaTime;
	    airplane.mesh.rotation.x += 0.0003*deltaTime;
	    game.planeFallSpeed *= 1.05;
	    airplane.mesh.position.y -= game.planeFallSpeed*deltaTime;

	    if (airplane.mesh.position.y <-200){
	      showReplay();
	      game.status = "waitingReplay";

	    }
	}
	else if (game.status=="waitingReplay"){

	}



	sea.mesh.rotation.z += game.speed*deltaTime;

	if (sea.mesh.rotation.z > 2*Math.PI){
		sea.mesh.rotation.z -= 2*Math.PI;
	}

	ambientLight.intensity += (0.5 - ambientLight.intensity)*deltaTime*0.005;

	sky.moveClouds();
	sea.moveWaves();

	coinsHolder.rotateCoins();

	enemiesHolder1.rotateEnemies(1);
	enemiesHolder2.rotateEnemies(2);

	//render the scene
	renderer.render(scene, camera);

	//update everything
	window.requestAnimationFrame(animate);
}

function updateDistance(){
	game.distance += game.speed*deltaTime*game.ratioSpeedDistance;
	fieldDistance.innerHTML = Math.floor(game.distance);
}

function updateEnergy(){
	game.energy -= game.speed*deltaTime*game.ratioSpeedEnergy;
	game.energy = Math.max(0, game.energy);
	energyBar.style.right = (100-game.energy)+"%";
	energyBar.style.backgroundColor = (game.energy<50)? "#f25346" : "#cdf9ff";

	if (game.energy <1){
    	game.status = "gameover";
  	}
}

function addEnergy(){
	game.energy += game.coinValue;
	game.energy = Math.min(game.energy, 100);
}

function removeEnergy(){
	game.energy -= game.enemyValue;
	game.energy = Math.max(0, game.energy);
}

function handleMouseMove(event){
	//normalize mouse position to vary between -1 and 1
	var tx = -1 + (event.clientX/WIDTH)*2;
	var ty = 1 - (event.clientY/HEIGHT)*2; //2d y-axis goes the opposite direction of the 3d y-axis
	mousePos = {x: tx, y: ty};
}

function onDocumentMouseDown(event){
	if(game.status == "playing"){
		if(parallelView == false){
			parallelView = true;
			camera.position.set(-200, game.planeDefaultHeight, 0);
			camera.lookAt(new THREE.Vector3(100, game.planeDefaultHeight, 0));
		}
		else{
			parallelView = false;
			camera.position.set(0, game.planeDefaultHeight, 200);
			camera.lookAt(new THREE.Vector3(0, game.planeDefaultHeight, 0));
		}
	}
	else if(game.status == "waitingReplay"){
		resetGame();
		hideReplay()
	}
}

function showReplay(){
	replayMessage.style.display = "block";
}

function hideReplay(){
	replayMessage.style.display = "none";
}

function normalize(v, vmin, vmax, tmin, tmax){
	var nv = Math.max(Math.min(v,vmax), vmin);
	var dv = vmax-vmin;
	var pc = (nv-vmin)/dv;
	var dt = tmax-tmin;
	var tv = tmin + (pc*dt);
	return tv;
}

window.addEventListener('load', init, false);
