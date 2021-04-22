# Moderation - commands for the Twitchchatbot

**All commands that are added via !add (!del). Are automatically added / deleted in the last position of the command list**

## **Add / edit / delete commands**

#### Adding a new command.

```
!add !(command name) (text)
    e.g. !add !test This is a test
```
#### Changing a saved command.<br>

```
!edit !(command name) (text)<br>
    e.g. !edit !test This is a new text
```     
#### Removing a saved command.<br>

```
!del !(command name)
    e.g. !del !test 
```    

## **Add / delete blacklist**

#### Add a word to the blacklist.<br>

```
!addbl (word)
    e.g. !addbl test
```          
#### Removing a saved word from the blacklist<br>

```
!delbl (word)
    e.g. !delbl test
```         
#### Display the words on the blacklist in the selected DC channel.<br>

```
!blacklist
```
## **Alias function**

#### Adds a new alias.<br>

```
!addalias (new alias) (main command)
    e.g. !addalias !testing !test
```
#### Removes an alias from the command list.<br>

```
!delalias (alias) (main command)
    e.g. !delalias !testing !test
```
## **Watchtime function**

Shows the time how long someone is watching. <br>

```
!uwtime (name)
    e.g. !uwtime username
```
