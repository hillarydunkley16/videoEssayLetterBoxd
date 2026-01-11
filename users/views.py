from django.shortcuts import render, redirect
from django.contrib import messages
from django.template import loader
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse
# Import User UpdateForm, ProfileUpdatForm
from .forms import UserRegisterForm, UserUpdateForm, UserSignInForm
from django.contrib.auth import login, authenticate
from .models import Profile
from movie_csv.models import Log 
from datetime import datetime, timezone

def register(request):
    if request.method == 'POST':
        form = UserRegisterForm(request.POST)
        if form.is_valid():
            form.save() # Save user to Database
            username = form.cleaned_data.get('username') # Get the username that is submitted
            # password = form.cleaned_data.get('password1')
            new_user = authenticate(username=request.POST['username'], password=request.POST['password1'])   
            # new_user = authenticate(user, password)
            login(request, new_user)
            messages.success(request, f'Account created for {username}!') # Show sucess message when account is created
            return redirect('home') # Redirect user to Homepage
    else:
        form = UserRegisterForm()
    return render(request, 'users/register.html', {'form': form})

def signin(request): 
    if request.method == 'POST': 
        form = UserSignInForm(request.POST)
        if form.is_valid(): 
            form.save()
            
            
    # Update it here
@login_required
def profile(request):
    loggedin_user = request.user
    user_logs = Log.objects.filter(user=loggedin_user)
    time_since_creation = (datetime.now(timezone.utc) - loggedin_user.date_joined).days
    if request.method == 'POST':
        u_form = UserUpdateForm(request.POST, instance=request.user)
        if u_form.is_valid(): 
            u_form.save()
            
            messages.success(request, f'Your account has been updated!')
            return redirect('users/profile.html') # Redirect back to profile page

    else:
        u_form = UserUpdateForm(instance=request.user)
       

    context = {
        'u_form': u_form,
        'user_logs': user_logs,
        'user': loggedin_user, 
        'time_since_creation': time_since_creation
    }

    return render(request, 'users/profile.html', context)

def testing(request): 
    
    profiles = Profile.objects.all().order_by('user_id', '-id').values()
    template = loader.get_template('users/testing.html')
    context = {
    'profiles': profiles,
  }
    return HttpResponse(template.render(context, request))

