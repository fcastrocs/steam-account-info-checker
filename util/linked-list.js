//double linked list
class LinkedList{
    constructor(array){
        this.head = new Object();
        this.head.val = null;
        this.head.next = null;
        this.head.prev = null;

        this.current = this.head;

        this.size = 0;
        this.iterations = 0; //this number increases when next() is called

        this.arrayToList(array)
    }

    arrayToList(array){
        if(!array){
            throw new Error("array is undefined");
        }

        //initialize head node
        this.head.val = array[0];
        let prev = this.head;
        this.size++;

        //Add the remaining nodes
        for(let i = 1; i < array.length; i++){
            let item = new Object();

            //set value
            item.val = array[i];

            //keep it circular
            item.next = this.head;
            this.head.prev = item;

            //set link to previous node
            item.prev = prev;
            prev.next = item;

            prev = item;
            
            this.size++;
        }
    }

    remove(item){
        if(!item){
            throw new Error("item is undefined");
        }

        if(this.size == 1){
            this.size = 0;
            return item;
        }

        if(item == this.head){
            this.head = this.head.next;
        }

        //get links
        let prev = item.prev;
        let next = item.next;

        //link
        prev.next = next;
        next.prev = prev;
        this.size--;
    }

    next(){
        this.iterations++;
        //Get the next item
        let cur = this.current;
        //Move iterator to this next item
        this.current = this.current.next;
        return cur;
    }
}

module.exports = LinkedList;