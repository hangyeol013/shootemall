import * as THREE from 'three';

class Player{
	constructor(options){
		const fps = options.fps || 30; //default fps
		
		this.animations = {};	
		
		this.options = options;
		this.object = options.object;
		
        this.speed = options.speed;
		
		const self = this;
		
		const pt = this.object.position.clone();
		pt.z += 10;
		this.object.lookAt(pt);
		
        if (options.animations){
            //Use this option to set multiple animations directly
            this.mixer = new THREE.AnimationMixer(this.object);
            options.animations.forEach( (animation)=>{
                self.animations[animation.name.toLowerCase()] = animation;
            })
			this.actionName = '';

        }
	}
	
	setTargetDirection(){
		const player = this.object;
		const pt = this.calculatedPath[0].clone();
		pt.y = player.position.y;
		player.lookAt(pt);
		this.quaternion = player.quaternion.clone();
		player.quaternion.copy(quaternion);
	}
	
	set action(name){
		//Make a copy of the clip if this is a remote player
		if (this.actionName == name.toLowerCase()) return;
		const clip = this.animations[name.toLowerCase()];
        //delete this.curAction;

		if (clip!==undefined){
			const action = this.mixer.clipAction( clip );
			//action.loop = THREE.LoopOnce;
			action.time = 0;
			//action.clampWhenFinished = true;
			this.mixer.stopAllAction();
			this.actionName = name.toLowerCase();
			//action.fadeIn(0.5);	
			action.play();
            //this.curAction = action;
		}
	}
	
	update(dt){
		const speed = this.speed;
		const player = this.object;
		const old_position = player.position.clone();

		
		if (this.mixer) 
			this.mixer.update(dt);

        /*if (this.calculatedPath && this.calculatedPath.length) {
            const targetPosition = this.calculatedPath[0];
			targetPosition.y = player.position.y;

            const vel = targetPosition.clone().sub(player.position);
            
            let pathLegComplete = (vel.lengthSq()<0.01);
            console.log(player.position, vel, targetPosition)
            if (!pathLegComplete) {
                //Get the distance to the target before moving
                const prevDistanceSq = player.position.distanceToSquared(targetPosition);
                vel.normalize();
                // Move player to target
                if (this.quaternion) player.quaternion.slerp(this.quaternion, 0.1);
                player.position.add(vel.multiplyScalar(dt * speed));
                //Get distance after moving, if greater then we've overshot and this leg is complete
                const newDistanceSq = player.position.distanceToSquared(targetPosition);
                pathLegComplete = (newDistanceSq > prevDistanceSq);
            } 
            
            if (pathLegComplete){
                // Remove node from the path we calculated
                this.calculatedPath.shift();
                if (this.calculatedPath.length==0){
                    player.position.copy( targetPosition );
                    this.action = 'idle';
                }else{
                    const pt = this.calculatedPath[0].clone();
                    pt.y = player.position.y;
                    const quaternion = player.quaternion.clone();
                    player.lookAt(pt);
                    this.quaternion = player.quaternion.clone();
                    player.quaternion.copy(quaternion); 
                }
            }
        }*/
		player.position.set(old_position.x, old_position.y, old_position.z);
		//player.scale.set(0.005, 0.005, 0.005);
		//player.updateMatrix();
    }
}

export { Player };